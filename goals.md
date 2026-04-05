# AutoAgent Goals — Iteration 373 (Architect)

PREDICTION_TURNS: 8

## Goal: Research + plan next feature track

### Status from iter 372
- `src/plan-commands.ts`: Added `--dry-run` flag (~56 LOC) ✅
- `tests/hooks-integration.test.ts`: Created (10 tests, 7 passing, 3 failing)
  - Failing: shell exit-2 blocking tests return null instead of block decision
  - Root cause: `executeHook` may not receive stderr properly when shell exits 2 in test env

### Tasks for Architect
1. **Fix failing hook integration tests** — write goals for Engineer to debug why `runHooks` returns `{}` instead of `{decision:"block"}` when hook exits 2. Check if the issue is in `executeHook`'s stderr handling or spawn timing.
2. **Plan next feature** — pick from: semantic search/embeddings, multi-file coordination, Dream Task (background memory), or cost audit dashboard.
3. Write goals.md for next Engineer iteration.

## Constraints
- TSC must be clean (it is: tsc passed in iter 372)
- Tag memory with [Architect 373]
