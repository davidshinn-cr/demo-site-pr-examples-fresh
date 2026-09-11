/** Fetch-style HTTP application, shared by the Node adapter and integration tests. */
import { isRecord } from "./contracts/model.ts";
import { DEMO_USERS, Store } from "./db/store.ts";
import { HttpError } from "./errors.ts";
import { checkout, parsePurchase } from "./services/checkout.ts";
import { parseQuoteRequest, quote } from "./services/pricing.ts";
import { Sessions } from "./services/sessions.ts";

export interface Application {
  handle(request: Request): Promise<Response>;
  close(): void;
}
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
export const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};
function json(
  value: unknown,
  status: number = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(value, {
    status,
    headers: { ...SECURITY_HEADERS, ...headers },
  });
}
function sessionToken(request: Request): string {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("session="))
      ?.slice(8) ?? ""
  );
}
async function body(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new HttpError(415, "Send JSON request data.");
  let text = "";
  let bytes = 0;
  const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 16384) {
          await reader.cancel().catch(() => undefined);
          throw new HttpError(413, "Request is too large.");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
}
/** Builds a loopback-only demo API. Call close when the owning server stops. */
export function createApplication(
  store: Store = new Store(),
  sessions: Sessions = new Sessions(),
): Application {
  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!LOCAL_HOSTS.has(url.hostname))
      throw new HttpError(403, "This demo is available on localhost only.");
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (
        origin !== url.origin &&
        origin !== "http://127.0.0.1:5173" &&
        origin !== "http://localhost:5173"
      )
        throw new HttpError(403, "Untrusted request origin.");
    }
    const path = url.pathname;
    if (path === "/api/demo-users" && request.method === "GET")
      return json(DEMO_USERS);
    if (path === "/api/session" && request.method === "POST") {
      const value = await body(request);
      if (!isRecord(value) || typeof value.userId !== "string")
        throw new HttpError(400, "Choose a demo user.");
      const token = sessions.create(value.userId);
      sessions.remove(sessionToken(request));
      return json(sessions.get(token), 200, {
        "set-cookie": `session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600`,
      });
    }
    const user = sessions.get(sessionToken(request));
    if (path === "/api/session" && request.method === "GET") return json(user);
    if (path === "/api/session" && request.method === "DELETE") {
      sessions.remove(sessionToken(request));
      return json({ signedOut: true }, 200, {
        "set-cookie":
          "session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0",
      });
    }
    if (path === "/api/products" && request.method === "GET")
      return json(store.products());
    if (path === "/api/pricing/quote" && request.method === "POST")
      return json(quote(store, parseQuoteRequest(await body(request))));
    if (path === "/api/orders" && request.method === "POST")
      return json(
        checkout(store, user, parsePurchase(await body(request))),
        201,
      );
    if (path === "/api/invoices" && request.method === "GET")
      return json(store.invoices(user.tenantId));
    if (path.startsWith("/api/invoices/") && request.method === "GET") {
      const invoice = store.invoice(
        path.slice("/api/invoices/".length),
        user.tenantId,
      );
      if (!invoice) throw new HttpError(404, "Invoice not found.");
      return json(invoice);
    }
    throw new HttpError(404, "Route not found.");
  }
  return {
    async handle(request: Request): Promise<Response> {
      try {
        return await route(request);
      } catch (error: unknown) {
        return json(
          {
            error:
              error instanceof HttpError
                ? error.message
                : "Unable to complete the request.",
          },
          error instanceof HttpError ? error.status : 500,
        );
      }
    },
    close(): void {
      store.close();
    },
  };
}
