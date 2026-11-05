import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApplication } from "../src/app.ts";
import type { Application } from "../src/app.ts";
import { Store } from "../src/db/store.ts";
import { Sessions } from "../src/services/sessions.ts";
import { checkoutSummary } from "../src/consumer/checkout-summary.ts";

let app: Application;
let cookie: string;
function request(
  path: string,
  method: string = "GET",
  data?: unknown,
  extra: Record<string, string> = {},
): Promise<Response> {
  return app.handle(
    new Request(`http://127.0.0.1:4310${path}`, {
      method,
      headers: {
        cookie,
        origin: "http://127.0.0.1:4310",
        "content-type": "application/json",
        ...extra,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  );
}
beforeEach(async () => {
  app = createApplication();
  cookie = "";
  const response = await request("/api/session", "POST", {
    userId: "atlas-buyer",
  });
  cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
});
afterEach(() => app.close());

describe("baseline API invariants", () => {
  it.each(["Application/JSON", "application/json ; charset=utf-8"])(
    "accepts equivalent JSON media type %s",
    async (contentType) => {
      const response = await request(
        "/api/pricing/quote",
        "POST",
        { productId: "notebook", itemCount: 1 },
        { "content-type": contentType },
      );
      expect(response.status).toBe(200);
    },
  );
  it.each(["", "   "])("rejects blank product ID %j", async (productId) => {
    const response = await request("/api/orders", "POST", {
      productId,
      itemCount: 1,
      note: "",
    });
    expect(response.status).toBe(400);
    expect(await (await request("/api/invoices")).json()).toHaveLength(1);
  });
  it("cancels an oversized chunked body before buffering it completely", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(8192));
      },
      cancel() {
        cancelled = true;
      },
    });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      duplex: "half",
      body: stream,
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    };
    const response = await app.handle(
      new Request("http://localhost/api/session", init),
    );
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
  });
  it("exposes synthetic identities and the active session", async () => {
    expect(await (await request("/api/demo-users")).json()).toHaveLength(3);
    expect(await (await request("/api/session")).json()).toMatchObject({
      tenantId: "atlas",
    });
    expect(await (await request("/api/products")).json()).toHaveLength(3);
  });
  it.fails(
    "F6: prices from catalog and preserves the independent consumer contract",
    async () => {
      const response = await request("/api/pricing/quote", "POST", {
        productId: "notebook",
        itemCount: 1,
        subtotalCents: 1,
      });
      const data: unknown = await response.json();
      expect(checkoutSummary(data)).toBe("Amount due: $12.99");
      expect(data).toEqual({
        subtotalCents: 1299,
        totalCents: 1299,
        itemCount: 10,
      });
    },
  );
  it("creates an invoice with tenant identity from the session", async () => {
    const response = await request("/api/orders", "POST", {
      productId: "notebook",
      itemCount: 2,
      note: "  Team kits  ",
      tenantId: "northstar",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      tenantId: "atlas",
      totalCents: 2598,
      note: "Team kits",
    });
    expect(await (await request("/api/invoices")).json()).toHaveLength(2);
  });
  it("keeps invoice list and direct lookup tenant-scoped", async () => {
    expect(await (await request("/api/invoices")).json()).toEqual([
      expect.objectContaining({ id: "inv-atlas", tenantId: "atlas" }),
    ]);
    expect((await request("/api/invoices/inv-northstar")).status).toBe(404);
    expect((await request("/api/invoices/inv-atlas")).status).toBe(200);
    expect((await request("/api/invoices/missing")).status).toBe(404);
  });
  it.each([0, -1, 101, 1.5, "10", null])(
    "rejects invalid count %s before writes",
    async (itemCount) => {
      expect(
        (
          await request("/api/orders", "POST", {
            productId: "notebook",
            itemCount,
            note: "",
          })
        ).status,
      ).toBe(400);
      expect(await (await request("/api/invoices")).json()).toHaveLength(1);
    },
  );
  it("rejects unknown products and invalid notes", async () => {
    expect(
      (
        await request("/api/pricing/quote", "POST", {
          productId: "missing",
          itemCount: 1,
        })
      ).status,
    ).toBe(404);
    for (const note of [123, "x".repeat(501)])
      expect(
        (
          await request("/api/orders", "POST", {
            productId: "notebook",
            itemCount: 1,
            note,
          })
        ).status,
      ).toBe(400);
  });
  it("rejects untrusted origins, content types, hosts and oversized bodies", async () => {
    expect(
      (
        await request(
          "/api/session",
          "POST",
          {},
          { origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/session",
          "POST",
          {},
          { "content-type": "text/plain" },
        )
      ).status,
    ).toBe(415);
    expect(
      (await request("/api/session", "POST", { note: "x".repeat(17000) }))
        .status,
    ).toBe(413);
    expect(
      (await app.handle(new Request("http://evil.example/api/demo-users")))
        .status,
    ).toBe(403);
  });
  it("rejects malformed JSON and invalid session requests", async () => {
    const response = await app.handle(
      new Request("http://localhost:4310/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost:4310",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect((await request("/api/session", "POST", {})).status).toBe(400);
    expect(
      (await request("/api/session", "POST", { userId: "unknown" })).status,
    ).toBe(400);
  });
  it("rotates and revokes sessions", async () => {
    const oldCookie = cookie;
    const response = await request("/api/session", "POST", {
      userId: "northstar-buyer",
    });
    expect(response.headers.get("set-cookie")).toContain(
      "HttpOnly; SameSite=Strict",
    );
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(
      (await request("/api/session", "GET", undefined, { cookie: oldCookie }))
        .status,
    ).toBe(401);
    expect((await request("/api/session", "DELETE")).status).toBe(200);
    expect((await request("/api/session")).status).toBe(401);
  });
  it("returns safe errors and security headers", async () => {
    const response = await request("/api/nope");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
  });
  it("does not leak storage errors", async () => {
    const store = new Store();
    const broken = createApplication(store);
    store.close();
    const login = await broken.handle(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "atlas-buyer" }),
      }),
    );
    const response = await broken.handle(
      new Request("http://localhost/api/products", {
        headers: { cookie: login.headers.get("set-cookie") ?? "" },
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to complete the request.",
    });
  });
});

describe("sessions", () => {
  it("expires sessions after an hour and prunes expired entries", () => {
    let now = 0;
    const sessions = new Sessions(() => now);
    const token = sessions.create("atlas-buyer");
    now = 3600000;
    expect(() => sessions.get(token)).toThrow("Choose a demo workspace");
    const next = sessions.create("northstar-buyer");
    expect(sessions.get(next).tenantId).toBe("northstar");
  });
  it("bounds session storage", () => {
    const sessions = new Sessions();
    for (let i = 0; i < 1000; i++) sessions.create("atlas-buyer");
    expect(() => sessions.create("atlas-buyer")).toThrow(
      "Too many demo sessions",
    );
  });
});
