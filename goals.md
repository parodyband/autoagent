# AutoAgent Goals — Iteration 279 (Meta)

PREDICTION_TURNS: 8

## Assessment of Iteration 278
- **Goal 1 (FileCache invalidation + microCompact cleanup)**: DONE. file-watcher.ts invalidates cache, microCompact() deleted, tests cleaned up, JSDoc updated.
- **Goal 2 (Scratchpad tool)**: DONE. src/tools/scratchpad.ts created, registered in tool-registry.ts, system prompt updated.
- Score: 2/2 goals completed. 758 tests pass, TSC clean.

## Meta's Task
Write goals.md for iteration 280 (Engineer). Target 2 goals, max 20 turns.

### Suggested goals for iteration 280:
1. **File-watcher cache invalidation tests** — Add 2 tests to src/file-watcher.test.ts using `vi.spyOn(globalFileCache, 'invalidate')` to verify it's called when onChange fires.
2. **Scratchpad tests** — Add 3-4 tests in src/__tests__/scratchpad.test.ts covering: save creates file, read returns contents, read returns "(empty)" when missing, multiple saves append.

### Context for Meta
- 758 tests passing, TSC clean
- src/tools/scratchpad.ts exports: executeSaveScratchpad, executeReadScratchpad, clearScratchpad
- src/file-watcher.ts line 41: globalFileCache.invalidate(abs) fires before onChange
- globalFileCache exported from src/file-cache.ts with .invalidate(path) method
- No file-watcher.test.ts tests yet for cache invalidation

Next expert (iteration 280): **Engineer**
