import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApplication } from "../src/app.ts";
import type { Application } from "../src/app.ts";
import { Store } from "../src/db/store.ts";
import { promotionalQuote } from "../src/services/promotions.ts";
import { migratePromotions, activePromotion } from "../src/db/promotions.ts";
import { bulkCheckout, parseBatch } from "../src/services/bulk-checkout.ts";
import { DEMO_USERS } from "../src/db/store.ts";
import { parseInvoice } from "../src/contracts/model.ts";

let app: Application;
let cookie: string;
async function call(
  path: string,
  method: string = "GET",
  data?: unknown,
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost:4310${path}`, {
      method,
      headers: {
        cookie,
        origin: "http://localhost:4310",
        "content-type": "application/json",
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  );
}
beforeEach(async () => {
  app = createApplication();
  cookie = "";
  const login = await call("/api/session", "POST", { userId: "atlas-admin" });
  cookie = login.headers.get("set-cookie") ?? "";
});
afterEach(() => app.close());
const promotion = { minimumItems: 10, percentOff: 10, expiresAt: 2000 };

describe("bulk checkout and promotional pricing", () => {
  it("does not discount before the threshold or at expiration", () => {
    expect(promotionalQuote(1299, 1, promotion, 1000).discountPercent).toBe(0);
    expect(promotionalQuote(12990, 11, promotion, 2000).discountPercent).toBe(
      0,
    );
    expect(promotionalQuote(12990, 11, promotion, 1000).discountPercent).toBe(
      10,
    );
  });
  it("validates the promotion row and applies migrations idempotently", () => {
    const store = new Store();
    try {
      migratePromotions(store);
      migratePromotions(store);
      expect(activePromotion(store).minimumItems).toBe(10);
      store.db.exec("DELETE FROM promotions");
      expect(() => activePromotion(store)).toThrow("Promotion unavailable");
    } finally {
      store.close();
    }
  });
  it.each([
    null,
    {},
    { items: [] },
    { items: new Array(11).fill({}) },
    { items: [{ productId: "notebook", itemCount: 0, note: "" }] },
  ])("rejects malformed batches", (value) => {
    expect(() => parseBatch(value)).toThrow();
  });
  it("creates a complete batch and rejects missing products before any writes", async () => {
    const response = await call("/api/orders/bulk", "POST", {
      items: [
        { productId: "notebook", itemCount: 11, note: "Welcome kits" },
        { productId: "desk-kit", itemCount: 2, note: "New starters" },
      ],
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toHaveLength(2);
    const bad = await call("/api/orders/bulk", "POST", {
      items: [
        { productId: "notebook", itemCount: 1, note: "" },
        { productId: "missing", itemCount: 1, note: "" },
      ],
    });
    expect(bad.status).toBe(404);
    expect(await (await call("/api/invoices")).json()).toHaveLength(3);
  });
  it("rolls back every write when the second insert fails", () => {
    const store = new Store();
    migratePromotions(store);
    const user = DEMO_USERS[0];
    if (!user) throw new Error("Missing fixture");
    const original = store.createInvoice.bind(store);
    const insert = vi.spyOn(store, "createInvoice");
    insert.mockImplementationOnce(original).mockImplementationOnce(() => {
      throw new Error("Storage failure");
    });
    try {
      expect(() =>
        bulkCheckout(store, user, [
          { productId: "notebook", itemCount: 1, note: "" },
          { productId: "desk-kit", itemCount: 1, note: "" },
        ]),
      ).toThrow("Storage failure");
      expect(store.invoices("atlas")).toHaveLength(1);
    } finally {
      store.close();
    }
  });
  it("searches literal product names and bounds input", async () => {
    expect(
      await (await call("/api/invoices/search?q=Field")).json(),
    ).toHaveLength(1);
    expect(
      await (await call("/api/invoices/search?q=unmatched")).json(),
    ).toHaveLength(0);
    expect(
      (await call("/api/invoices/search?q=" + "x".repeat(101))).status,
    ).toBe(400);
  });
  it("exports an invoice for an administrator and rejects buyers", async () => {
    const exported = await call("/api/invoices/inv-atlas/export");
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toContain("text/html");
    expect(await exported.text()).toContain("Welcome kits");
    expect((await call("/api/invoices/missing/export")).status).toBe(404);
    const login = await call("/api/session", "POST", { userId: "atlas-buyer" });
    cookie = login.headers.get("set-cookie") ?? "";
    expect((await call("/api/invoices/inv-atlas/export")).status).toBe(403);
  });
});

describe("acceptance criteria — known flagship defects", () => {
  it.fails(
    "F1: a tenant administrator cannot export another tenant invoice",
    async () => {
      expect((await call("/api/invoices/inv-northstar/export")).status).toBe(
        404,
      );
    },
  );
  it.fails("F2: search input cannot escape the tenant predicate", async () => {
    const response = await call(
      "/api/invoices/search?q=" + encodeURIComponent("' OR 1=1 --"),
    );
    const rows: unknown = await response.json();
    expect(rows).toEqual([expect.objectContaining({ tenantId: "atlas" })]);
  });
  it.fails("F3: stored notes are encoded in standalone HTML", async () => {
    const response = await call("/api/orders", "POST", {
      productId: "notebook",
      itemCount: 1,
      note: '<script>document.title="note-executed"</script>',
    });
    const invoice = parseInvoice(await response.json());
    const html = await (
      await call(`/api/invoices/${invoice.id}/export`)
    ).text();
    expect(html).not.toContain("<script>");
  });
  it.fails("F4: exactly ten items qualify for the bulk discount", () => {
    expect(promotionalQuote(10000, 10, promotion, 1000).discountPercent).toBe(
      10,
    );
  });
  it.fails("F5: API monetary amounts retain integer-cent units", async () => {
    const response = await call("/api/pricing/quote", "POST", {
      productId: "notebook",
      itemCount: 11,
    });
    const data: unknown = await response.json();
    expect(data).toMatchObject({ totalCents: 12860 });
  });
});
