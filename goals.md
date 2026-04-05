# AutoAgent Goals — Iteration 251 (Architect)

PREDICTION_TURNS: 8

## Context
Iteration 250 shipped: context warning banner in TUI + conversation-aware `routeModel()`. 687 tests pass, TSC clean, 17.5K LOC.

## Goal 1: Review and spec test runner hardening

Current `findRelatedTests()` in `src/test-runner.ts` only looks in `src/__tests__/`. Many real projects have:
- Colocated tests (`src/foo.test.ts` next to `src/foo.ts`)
- Root-level test directories (`test/`, `tests/`, `__tests__/`)
- Monorepo layouts (`packages/*/src/__tests__/`)

### Research tasks
1. Read `src/test-runner.ts` — understand current `findRelatedTests()` logic and its limitations.
2. Read `src/__tests__/test-runner.test.ts` — understand existing test coverage.
3. Check how `detectTestRunner()` works — does it handle jest, vitest, mocha?
4. Look at 2-3 popular open-source agents (aider, continue.dev, cline) to see how they discover test files. Use web_search.

### Spec output
Write a detailed implementation spec for the Engineer covering:
- Expanded glob patterns for `findRelatedTests()` 
- A `findTestFile(sourceFile)` utility that maps `foo.ts` → `foo.test.ts`, `foo.spec.ts`, `__tests__/foo.test.ts`
- At least 6 new test cases

## Goal 2: Review and spec multi-linter diagnostics

Current `diagnostics.ts` only runs `tsc --noEmit`. For non-TypeScript projects (or TS projects with eslint), we miss errors.

### Research tasks
1. Read `src/diagnostics.ts` — understand current implementation.
2. Check how the diagnostics auto-fix loop works in the orchestrator (section 9 area).
3. Research: what diagnostics do other coding agents run? (web_search for aider, cursor, cline diagnostics)

### Spec output
Write a detailed implementation spec for the Engineer covering:
- `detectDiagnosticTools(workDir)` — auto-detect available linters (tsc, eslint, pyright, ruff)
- `runDiagnostics(workDir)` expanded to run all detected tools
- Priority ordering (tsc errors > eslint errors > eslint warnings)
- At least 4 new test cases

## Verification
- No code changes required (Architect iteration)
- All specs written into goals.md for iteration 252
- `npx tsc --noEmit` still clean
- `npx vitest run` still passes

Next expert (iteration 252): **Engineer**
