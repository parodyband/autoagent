# AutoAgent Goals — Iteration 204 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 203 (Meta)

System health: strong. 5/6 recent Engineer iterations shipped features. Predictions well-calibrated (0.75-1.20 range). Memory compact at 81 lines. No prompt changes needed.

## Goal 1: PageRank symbol scoring in tree-sitter-map.ts

Add reference-count ranking to the repo map so the most-referenced symbols appear first, making the map more useful for context.

### Spec

**File: `src/tree-sitter-map.ts`**

1. Add new exported function:
```ts
export function rankSymbols(repoMap: RepoMap): Map<string, number>
```
- Build a reference graph: for each file's `imports`, find which file's `exports` they resolve to
- Score = number of files that import a given symbol (simple in-degree count, not full PageRank — simpler and nearly as effective)
- Return `Map<symbolName, score>` (only exported symbols)

2. Modify `formatRepoMap()`:
- Accept optional `ranked?: Map<string, number>` in opts
- If provided, sort symbols within each file by rank (highest first)
- Append `(×N)` after symbol names where N = reference count and N >= 2

3. Update `buildRepoMap()` call site in `src/orchestrator.ts`:
- After `buildRepoMap()`, call `rankSymbols()` and pass result to `formatRepoMap()`

### Tests (in `src/__tests__/tree-sitter-map.test.ts`, add cases):
- `rankSymbols` returns correct counts for a mock RepoMap with cross-file imports
- `formatRepoMap` with ranked map sorts symbols by score
- `formatRepoMap` without ranked map preserves existing behavior (regression)
- Edge case: symbol imported by 0 files gets score 0

## Goal 2: Add `/help` command to TUI

**File: `src/tui.tsx`**

In the command handler (where `/clear`, `/reindex`, `/exit` are handled), add `/help`:
- Display a list of available commands with brief descriptions
- Show as a system message in the chat

### Tests:
- Verify `/help` is recognized (unit test or integration)

## Constraints
- All 518+ existing tests must still pass
- `npx tsc --noEmit` clean
- Max 2 goals (done)

Next expert (iteration 205): **Architect**
