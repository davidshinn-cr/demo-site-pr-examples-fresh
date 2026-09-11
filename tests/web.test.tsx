// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, PurchaseWorkspace } from "../src/web/App.tsx";
import { api } from "../src/web/api.ts";
import type { Product, User } from "../src/contracts/model.ts";

const user: User = {
  id: "atlas-buyer",
  name: "Jordan Lee",
  tenantId: "atlas",
  organization: "Atlas Studio",
  role: "buyer",
};
const product: Product = {
  id: "notebook",
  name: "Field notebook",
  description: "Dotted pages",
  unitCents: 1299,
};
let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function chooseUser(): Promise<void> {
  const select = container.querySelector("select");
  if (!select) throw new Error("Missing workspace selector");
  await act(async () => {
    select.value = user.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}
async function submit(value: string): Promise<void> {
  const form = container.querySelector("form");
  const button = container.querySelector(`button[value="${value}"]`);
  if (!form || !(button instanceof HTMLButtonElement))
    throw new Error("Missing purchase form");
  await act(async () => {
    form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: button,
      }),
    );
  });
  await flush();
}

describe("purchase workspace", () => {
  it("loads an identity, previews a quote, and creates an invoice", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/demo-users") return Response.json([user]);
      if (path === "/api/session") return Response.json(user);
      if (path === "/api/products") return Response.json([product]);
      if (path === "/api/invoices") return Response.json([]);
      if (path === "/api/pricing/quote")
        return Response.json({
          subtotalCents: 1299,
          totalCents: 1299,
          itemCount: 1,
        });
      return Response.json({
        id: "new-invoice",
        tenantId: "atlas",
        productName: "Field notebook",
        itemCount: 1,
        totalCents: 1299,
        note: "Team kits",
        createdAt: "2026-09-11",
      });
    });
    await act(async () => root.render(<App />));
    await flush();
    expect(container.textContent).toContain("Your next team order starts here");
    await chooseUser();
    expect(container.textContent).toContain("Purchasing for Atlas Studio");
    await submit("quote");
    expect(container.textContent).toContain("Amount due: $12.99");
    await submit("order");
    expect(container.textContent).toContain("Order placed");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/api/invoices/new-invoice",
    );
  });
  it("shows a recoverable initial connection error", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(Response.json([user]));
    await act(async () => root.render(<App />));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Offline",
    );
    await act(async () => container.querySelector("button")?.click());
    await flush();
    expect(container.querySelector("select")).not.toBeNull();
  });
  it("shows a session load failure without rendering stale invoices", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json([user]))
      .mockRejectedValueOnce(new Error("Session unavailable"));
    await act(async () => root.render(<App />));
    await flush();
    await chooseUser();
    expect(container.textContent).toContain("Session unavailable");
    expect(container.querySelector("table")).toBeNull();
  });
  it("shows action failure and permits retry", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ error: "Please retry" }, { status: 503 }),
      )
      .mockResolvedValueOnce(
        Response.json({ subtotalCents: 1299, totalCents: 1299, itemCount: 1 }),
      );
    await act(async () =>
      root.render(
        <PurchaseWorkspace
          user={user}
          products={[product]}
          initialInvoices={[]}
        />,
      ),
    );
    await submit("quote");
    expect(container.textContent).toContain("Please retry");
    await submit("quote");
    expect(container.textContent).toContain("Amount due");
  });
  it("renders stored notes as text", async () => {
    await act(async () =>
      root.render(
        <PurchaseWorkspace
          user={user}
          products={[product]}
          initialInvoices={[
            {
              id: "invoice",
              tenantId: "atlas",
              productName: "Notebook",
              itemCount: 1,
              totalCents: 1299,
              note: "<img src=x onerror=alert(1)>",
              createdAt: "2026-09-11",
            },
          ]}
        />,
      ),
    );
    expect(container.querySelector(".invoice-note")?.textContent).toContain(
      "<img",
    );
    expect(container.querySelector(".invoice-note img")).toBeNull();
  });
  it("aborts pending workspace requests on unmount", async () => {
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_input, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    await act(async () => root.render(<App />));
    await act(async () => root.unmount());
    expect(signal?.aborted).toBe(true);
    root = createRoot(container);
  });
  it("aborts an in-flight purchase on unmount", async () => {
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_input, init) => {
      signal = init?.signal;
      return new Promise(() => {});
    });
    await act(async () =>
      root.render(
        <PurchaseWorkspace
          user={user}
          products={[product]}
          initialInvoices={[]}
        />,
      ),
    );
    await submit("quote");
    await act(async () => root.unmount());
    expect(signal?.aborted).toBe(true);
    root = createRoot(container);
  });
});
describe("HTTP client", () => {
  it("preserves headers supplied as a Headers object, tuples, or a record", async () => {
    const variants: HeadersInit[] = [
      new Headers({ "x-test": "yes" }),
      [["x-test", "yes"]],
      { "x-test": "yes" },
    ];
    fetchMock.mockImplementation(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-test")).toBe("yes");
      expect(headers.get("content-type")).toBe("application/json");
      return Response.json({ ok: true });
    });
    for (const headers of variants) await api("/api/test", { headers });
  });
  it("uses a status fallback for an empty server error", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { status: 502, statusText: "Bad Gateway" }),
    );
    await expect(api("/api/nope")).rejects.toThrow(
      "Request failed (502 Bad Gateway)",
    );
  });
  it("uses a safe fallback for malformed error responses", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 500 }));
    await expect(api("/api/nope")).rejects.toThrow("Request failed");
  });
  it("rejects invalid JSON responses", async () => {
    fetchMock.mockResolvedValue(new Response("invalid"));
    await expect(api("/api/nope")).rejects.toThrow();
  });
});
