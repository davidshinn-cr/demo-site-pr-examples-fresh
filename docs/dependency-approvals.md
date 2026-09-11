# Dependency approval

September 11, 2026: the maintainer approved React, React DOM, TypeScript, Vite, Vitest, its V8 coverage plugin, ESLint, typescript-eslint, Prettier, jsdom, and Node/React type packages after a clean vulnerability check.

Versions are pinned in package.json and the complete resolution is recorded in package-lock.json. Resolve with scripts disabled, run npm audit, then install only after a clean result. No intentionally vulnerable dependencies are needed for these examples. Node's built-in SQLite avoids an additional database dependency.
