# Quote to order · CodeRabbit PR examples

A local multi-tenant purchasing application for CodeRabbit Solutions Architects. This repository owns all application, consumer, and example code. `demo-site` owns the learning platform; no changes to it or `security-harness` are required.

## Run

Use Node 24 and npm 11. The application uses Node's bundled SQLite driver.

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open http://127.0.0.1:4310. Choose a demo identity, preview a quote, place an order, and open its invoice. Prices come from the server catalog. All identities, organizations, and purchases are synthetic; no payment is collected.

For development, run `npm run dev:api` and `npm run dev` in separate terminals, then open http://127.0.0.1:5173.

The API binds only to loopback and checks Host and Origin. The identity selector is deliberately a local demo login, not production authentication. Sessions expire after one hour. SQLite data persists in `.local/orders.sqlite`; stop the server and delete that file to reseed. Do not expose the demo through a tunnel or deploy it publicly.

## Architecture

```text
React purchase workspace
  → HTTP routes / session identity
    → pricing and checkout services
      → tenant-scoped SQLite store
  → independent pricing-response consumer
```

- `src/contracts`: validated HTTP DTOs; money uses integer cents.
- `src/services`: session lifetime, input validation, pricing, and checkout.
- `src/db`: catalog and tenant-scoped invoice persistence.
- `src/consumer`: an independent pricing consumer, kept in this repository.
- `src/app.ts`: Fetch API route handler, exercised directly by integration tests.
- `src/server.ts`: bounded HTTP adapter and built frontend hosting.
- `src/web`: React purchasing UI with cancellation and explicit error states.

The baseline has no discounts: quantity 10 costs exactly ten unit prices. The flagship feature introduces promotional pricing and exports on top of this baseline.

## Validation

```sh
npm run check
```

Runs formatting, ESLint, strict TypeScript, production build, Vitest with V8 coverage, and npm advisory checks. Tests cover tenant isolation, server pricing, request validation, session rotation/expiry, consumer validation, and UI behavior. Python checks are not applicable. Coverage is reported; do not interpret untested code as verified.

Review committed changes with `coderabbit review --committed --base main` before pushing the baseline. The CLI must be authenticated. Branches and PRs follow AGENTS.md; this application does not waive its review or merge gates.

## References

- Official branding: https://www.coderabbit.ai/brand
- Shared standards: https://github.com/coderabbit-demo/coderabbit-standards
- Learning platform: https://fe-demo-site.vercel.app/

The consumer is intentionally local. Its presence demonstrates contract compatibility, not cross-repository detection. A true cross-repository example needs a separately authorized consumer repository integration.
