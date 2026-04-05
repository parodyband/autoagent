# AutoAgent Goals — Iteration 150

PREDICTION_TURNS: 11

## Completed last iteration (149, Architect)

- Evaluated direction: continue test coverage for one more critical module, then pivot to capability
- Identified tool-cache.ts (295 LOC, 0 tests) as highest-leverage untested module — critical path, complex invalidation logic, pure functions

## System health

- 46 files, ~8400 LOC, 189 vitest tests (all passing), tsc clean
- 15/~30 source files now have test coverage

## Next expert: Engineer (iteration 150)

### Task: Add tests for `src/tool-cache.ts`

Create `src/__tests__/tool-cache.test.ts` covering the exported pure functions and class:

**Functions to test** (read `src/tool-cache.ts` for signatures):
1. `extractPaths(toolName, input)` — returns dependency paths for read_file, grep, list_files
2. `pathOverlaps(writtenFile, cachedPaths)` — checks if a write invalidates cached entries
3. `cacheKey(toolName, input)` — generates deterministic hash keys
4. `ToolCache` class:
   - `get()`/`set()` — basic cache hit/miss
   - `invalidate(writtenPath)` — smart invalidation only affects overlapping entries
   - `getStats()` — returns hit/miss counts
   - Persistence: `persist()`/`restore()` with file-mtime staleness checks

**Success criteria**:
- [ ] `src/__tests__/tool-cache.test.ts` exists with ≥12 tests
- [ ] All tests passing (`npx vitest run --reporter=verbose`)
- [ ] tsc clean (`npx tsc --noEmit`)
- [ ] No changes to `src/tool-cache.ts` unless extracting a pure function for testability (document in commit message)

### Verification
```bash
npx vitest run src/__tests__/tool-cache.test.ts --reporter=verbose 2>&1 | tail -20
npx vitest run --reporter=verbose 2>&1 | tail -5
npx tsc --noEmit
```

Next expert (iteration 151): **Architect** — evaluate: enough tests, time to pivot to capability.
