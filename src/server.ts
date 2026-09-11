/** Bounded Node HTTP adapter. Binds to loopback; data persists under .local/. */
import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createApplication } from "./app.ts";
import { Store } from "./db/store.ts";

mkdirSync(".local", { recursive: true });
const app = createApplication(new Store(".local/orders.sqlite"));
const port = 4310;
const staticRoot = resolve("dist");
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      outgoing.writeHead(403).end("Localhost only");
      return;
    }
    const url = new URL(incoming.url ?? "/", `http://${host}`);
    if (!url.pathname.startsWith("/api/")) {
      if (incoming.method !== "GET") {
        outgoing.writeHead(405).end();
        return;
      }
      const file = resolve(
        staticRoot,
        `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
      );
      if (!file.startsWith(staticRoot + sep)) {
        outgoing.writeHead(404).end();
        return;
      }
      try {
        const bytes = readFileSync(file);
        outgoing.writeHead(200, {
          "content-type": mime[extname(file)] ?? "application/octet-stream",
          "x-content-type-options": "nosniff",
          "content-security-policy":
            "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
        });
        outgoing.end(bytes);
      } catch {
        outgoing.writeHead(404).end("Build the app with npm run build.");
      }
      return;
    }
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 16384) {
        outgoing.writeHead(413).end("Request too large");
        return;
      }
      chunks.push(buffer);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (typeof value === "string") headers.set(name, value);
    const request = new Request(url, {
      method: incoming.method ?? "GET",
      headers,
      ...(chunks.length > 0
        ? { body: Buffer.concat(chunks).toString("utf8") }
        : {}),
    });
    const response = await app.handle(request);
    outgoing.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    );
    outgoing.end(await response.text());
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(400);
    outgoing.end("Invalid request");
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on("error", (error: Error) => {
  console.error(`Unable to start the local demo: ${error.message}`);
  app.close();
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Quote to order: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    server.close(() => {
      app.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
