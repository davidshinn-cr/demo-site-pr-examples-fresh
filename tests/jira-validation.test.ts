import { describe, expect, it, vi } from "vitest";
import { createApplication } from "../src/app.ts";

/** CRDEMO-2's error-disclosure invariant, exercised in this repository only. */
describe("CRDEMO-2: malformed JSON never exposes stack traces", () => {
  it.each(["development", "production"])(
    "sanitizes parser errors in %s mode",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      const app = createApplication();
      try {
        const login = await app.handle(
          new Request("http://localhost/api/session", {
            method: "POST",
            headers: {
              origin: "http://localhost",
              "content-type": "application/json",
            },
            body: JSON.stringify({ userId: "atlas-buyer" }),
          }),
        );
        const response = await app.handle(
          new Request("http://localhost/api/pricing/quote", {
            method: "POST",
            headers: {
              origin: "http://localhost",
              "content-type": "application/json",
              cookie: login.headers.get("set-cookie") ?? "",
            },
            body: "{",
          }),
        );
        expect(response.status).toBe(400);
        const text = await response.text();
        expect(JSON.parse(text)).toEqual({ error: "Invalid JSON request." });
        expect(text).not.toMatch(
          /SyntaxError|node_modules|at .*\(|\/Users\/|stack/i,
        );
        const unauthenticated = await app.handle(
          new Request("http://localhost/api/pricing/quote", {
            method: "POST",
            headers: {
              origin: "http://localhost",
              "content-type": "application/json",
            },
            body: "{",
          }),
        );
        expect(unauthenticated.status).toBe(401);
        expect(await unauthenticated.text()).not.toMatch(
          /SyntaxError|node_modules|\/Users\/|stack/i,
        );
      } finally {
        app.close();
        vi.unstubAllEnvs();
      }
    },
  );
});
