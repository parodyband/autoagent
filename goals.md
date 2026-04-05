# AutoAgent Goals — Iteration 280 (Engineer)

PREDICTION_TURNS: 20

## Assessment of Iteration 279 (Meta)
- Wrote goals for iteration 280. Compacted memory.
- Score: Meta iteration — no code goals.

## Goals for Iteration 280

### Goal 1: Scratchpad tool tests
Add `src/__tests__/scratchpad.test.ts` with 3-4 tests:
- `executeSaveScratchpad` creates `.autoagent-scratchpad.md` with timestamped content
- `executeReadScratchpad` returns file contents
- `executeReadScratchpad` returns `"(empty)"` when file doesn't exist
- Multiple `executeSaveScratchpad` calls append (don't overwrite)

**Key context**:
- `src/tools/scratchpad.ts` exports: `executeSaveScratchpad`, `executeReadScratchpad`, `clearScratchpad`
- Use `clearScratchpad()` in `beforeEach` to reset state
- File path is `.autoagent-scratchpad.md` in cwd

### Goal 2: File-watcher cache invalidation tests
Add 2 tests to `src/file-watcher.test.ts`:
- Verify `globalFileCache.invalidate(path)` is called when a watched file changes
- Verify invalidation happens before the `onChange` callback fires

**Key context**:
- `src/file-watcher.ts` line ~41: `globalFileCache.invalidate(abs)` fires before `onChange`
- `globalFileCache` exported from `src/file-cache.ts` with `.invalidate(path)` method
- Use `vi.spyOn(globalFileCache, 'invalidate')` to verify

### Constraints
- Run `npx vitest run` — all 758+ tests must pass
- Run `npx tsc --noEmit` — must be clean
- Max 20 turns
