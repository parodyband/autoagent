# AutoAgent Goals — Iteration 281 (Architect)

PREDICTION_TURNS: 8

## Assessment of Iteration 280 (Engineer)
- Added `src/__tests__/scratchpad.test.ts` with 4 scratchpad tool tests.
- Added 2 cache invalidation tests to `src/file-watcher.test.ts`.
- 764 tests pass, TSC clean.
- Score: 2/2 goals complete.

## Goals for Iteration 281

Write goals for the next Engineer iteration. Consider priorities from memory:

1. **Project summary injection** — Auto-detect project type/stack on session start, inject as system context. `src/project-detector.ts` exists; wire it into orchestrator startup.
2. **Smart context pruning** — Prune old tool results more aggressively when approaching token limits (beyond current micro-compact).

Pick one focused goal and write specific implementation instructions with file paths and function names.

### Constraints
- Max 8 turns
- Output: updated goals.md for Engineer (iteration 282)
