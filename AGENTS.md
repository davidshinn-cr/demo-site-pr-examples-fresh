# Repository development workflow

These rules apply to every change in this repository, including application code, tests, documentation, configuration, and tooling. They apply to all contributors and coding agents.

## 1. Dependency approval

Do not add packages, dependencies, or tools (Python or otherwise) that have known security issues without the maintainer's explicit approval. 

## 2. Local CodeRabbit review before every push

Run the CodeRabbit CLI locally over the committed changes before every push. Use the installed CLI's supported committed-change review syntax, for example:

```sh
coderabbit review --committed --base main
```

Verify the appropriate base branch or commit and review the complete set of changes intended for the push. Commit fixes locally and review the updated committed changes again before pushing. If the CLI is unavailable, unauthenticated, or fails to complete, stop and report the blocker; a failed review is not a clean review. Once the PR has been created, additional changes to fix PR findings don't need CLI reviews as they will be reviewed at the PR level.

## 3. Zero CLI findings, with a four-iteration cap

Before pushing commits, run the local review, validate its findings, resolve actionable findings, and re-run after each fix. Target zero findings before pushing.

Cap the local review/fix cycle for a proposed change at four completed CLI review iterations. Fix commits and amendments within that cycle do not reset the count. Track the iteration count and remaining findings.

If findings remain after four passes, stop and ask the maintainer whether to continue with additional CLI iterations or push and let CodeRabbit review the PR on GitHub. Do not choose either option without explicit approval.

Obtain explicit maintainer approval before skipping any specific finding, including findings believed to be marginal, hypothetical, or false positives. Document every approved skipped finding in the PR description, stating what it was and why it was skipped. Approval to push after four iterations does not by itself approve skipping individual findings.

## 4. CodeRabbit PR review and merge gate

After an authorized push, create or update a pull request. Wait until CodeRabbit has fully reviewed the latest PR changes and reports no blocking findings. Validate and resolve findings, and obtain a fresh review when fixes change the PR. Every fix and resolution must include an in-line reply to the finding detailing what was fixed or the justification for not accepting a finding.

Never merge directly to main or bypass the pull request workflow. Never merge past unresolved blocking findings. Pending, failed, or absent reviews do not satisfy the merge gate. The local four-iteration exception does not waive the PR review requirement.

Include validation results, CLI review iteration counts, remaining findings where the maintainer approved pushing, and all explicitly approved skipped findings in the PR description.

## 5. Language best practices

### TypeScript and React

Use TypeScript for application code and keep changes narrowly scoped to the requested behavior.

- Enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` in the TypeScript configuration. Do not weaken compiler checks to make a change pass.
- Explicitly type function parameters, exported function return values, component props, and public module boundaries. Use local inference where the type is clear; avoid redundant annotations.
- Do not use `any` to bypass checking. Treat external data as `unknown` and narrow it with runtime validation before use. Validate tour JSON, URL parameters, and media metadata at their boundaries; a type assertion is not validation.
- Model distinct states with discriminated unions and handle variants exhaustively. Avoid collections of optional fields or boolean flags that permit invalid states.
- Avoid non-null assertions, unchecked casts, and TypeScript suppression comments. Prove invariants through validation, control-flow narrowing, or explicit error handling instead.
- Keep functions, components, hooks, and modules small and single-purpose. Use descriptive names, early returns, and guard clauses; avoid deep nesting and unrelated refactors.
- Keep variables and helpers in the narrowest useful scope. Export only intentional public APIs, prefer `const` and readonly data, and never mutate React props or state directly.
- Separate pure content validation and playback calculations from rendering and side effects. Keep effects focused, include their dependencies, and clean up listeners, timers, and pending work to prevent stale updates.
- Handle promise failures explicitly. Preserve useful error context without exposing secrets, and provide typed, recoverable error states where appropriate.
- Document module responsibilities and public functions with concise TSDoc, especially non-obvious invariants, timestamp units, side effects, and failure behavior.

### Python

For Python code:

- Enforce static typing and fully annotate function signatures, including parameters and return types.
- Use self-documenting names.
- Add docstrings to modules and public functions.
- Keep functions small and single-purpose.
- Avoid deep nesting; prefer early returns and guard clauses.

## 6. Full test coverage

Add tests for new and changed behavior and target full coverage. Tests must verify meaningful behavior, including relevant failure paths and edge cases.

## 7. Lint and static analysis before push

Run the repository's linter and static checkers before pushing and keep them clean. Required Python checks are:

- Ruff for linting and formatting.
- Mypy for static types.
- Bandit for security analysis.
- Pytest for tests.

For TypeScript, require a clean `tsc --noEmit` check with the strict settings above, and run the repository-configured lint, format, security, and test checks before pushing. Test runtime validation, discriminated-state transitions, asynchronous failure and cleanup paths, and changed user behavior; static typing does not replace runtime tests.

Do not introduce Python solely to run Python-specific checks on non-Python files. Report which checks ran and which are not applicable. If a required tool or dependency is missing, request approval for that individual addition under rule 1 rather than installing it silently or claiming the check passed. Naming a tool in these instructions does not authorize installing it.

## 8. Worktree isolation

Where practical, perform each change on its own branch in a dedicated git worktree so parallel work does not collide.

Before staging, testing, reviewing, or pushing, verify the worktrees and checked-out branch:

```sh
git worktree list
git branch --show-current
git status --short --branch
```

Confirm that the working directory, branch, and changes belong to the intended task. Do not stage unrelated changes or work directly on main.

## 9. Mandatory CodeRabbit branding for every UI change

All future UI changes must follow the official [CodeRabbit brand guidelines](https://www.coderabbit.ai/brand). Review the current guidelines before changing interface visuals, and use `DESIGN.md` and `public/brand/README.md` for the project's implementation details and asset provenance. If those local references drift from the official guidelines, update them alongside the UI.

- Keep the application in dark mode unless the maintainer explicitly requests otherwise. Use the official dark Mauve palette, CR Orange as the primary accent, and Mint/Cobalt only as supporting accents.
- Use the supplied white CodeRabbit logotype on dark backgrounds. Preserve the artwork, proportions, orientation, and clear space. Do not redraw, recolor, crop, distort, or recreate the logo with substitute typography. Use the official standalone mark only where the full logotype cannot fit.
- Use Geist Regular 400 for reading text, navigation, and calls to action; Geist Semibold 600 for headings. Use Hack Regular 400 for technical metadata and Hack Bold 700 for technical labels and metrics.
- Reuse the shared color and typography tokens in `src/styles.css` and approved assets in `public/brand/`. Do not introduce competing palettes, fonts, or improvised brand marks. Preserve bundled font licenses and record the source of any updated brand assets.
- Verify brand consistency, text contrast, keyboard focus, responsive layouts, and logo legibility on desktop and mobile after UI changes. Brand compliance must not come at the expense of accessibility.

The brand requirement does not waive the individual dependency-approval, testing, CodeRabbit review, or merge rules above.
