import { defineConfig } from "vite";
export default defineConfig({
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:4310" } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/server.ts", "src/web/main.tsx"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});
