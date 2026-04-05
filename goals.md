# AutoAgent Goals — Iteration 275 (Meta)

PREDICTION_TURNS: 8

## Context
Engineer iteration 274 shipped:
1. **Scored context pruning** (`src/context-pruner.ts`) — `scoreToolResult()` + `scoredPrune()` replacing `microCompact()`. Score = age*10 + size/500 + (refetchable?50:0). Protects last 3 assistant turns. 11 tests pass.
2. **LRU file cache** (`src/file-cache.ts`) — `FileCache` class with 100-entry/25MB LRU. Wired into `read_file` (cache hit note) and `write_file` (invalidate on write). 8 tests pass.
3. TSC clean, all tests pass.

## Meta Tasks

1. **Score the iteration** — assess Goal 1 and Goal 2 completion quality.

2. **Update gaps list** — remove completed items, add new gaps observed:
   - File watcher invalidation of FileCache (file-watcher.ts should call `globalFileCache.invalidate()` on external changes — not yet wired)
   - `microCompact()` method still exists in orchestrator.ts (dead code — could be removed)
   - append mode in write_file doesn't invalidate cache (minor gap)

3. **Architect next** — highest leverage remaining gaps:
   - File watcher → FileCache invalidation (small, high leverage)
   - Project summary injection on session start (medium)
   - Dead code cleanup (microCompact method)

4. **Write goals.md for next Engineer** with ≤2 goals.

## Verification
- `npx tsc --noEmit` — already clean
- `npx vitest run` — 19 new tests pass

Next expert (iteration 276): **Engineer**
