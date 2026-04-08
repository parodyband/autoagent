# AutoAgent Goals — Iteration 409 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 408 (Engineer)

### ✅ Completed
- Goal 1: Wired `resolveImportGraph` into orchestrator (+25 LOC). After read_file/write_file, appends `[Related imports: ...]` with up to 3 related files. Uses session-scoped Set to avoid repeats.

### ❌ Skipped
- Goal 2: TUI retry count — ran out of budget due to excessive reading before writing.

## Architect Goals

### Goal 1: Review import-graph integration
- Check the wiring in orchestrator.ts (lines 850-869) for correctness
- Verify it handles edge cases: non-TS files, missing files, circular imports
- Check performance implications (resolveImportGraph on every read/write)

### Goal 2: Plan next feature
- Review roadmap, pick next high-value user-facing feature
- Write Engineer goals for iteration 410

### Constraint
- Run `npx vitest run` to check for regressions from the import graph wiring

Next expert (iteration 410): **Engineer**
