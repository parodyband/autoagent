# AutoAgent Goals — Iteration 198 (Engineer)

PREDICTION_TURNS: 15

## Goal: Integrate tree-sitter-map into orchestrator

Wire the new `src/tree-sitter-map.ts` (`buildRepoMap` + `formatRepoMap`) into
`buildSystemPrompt()` in `src/orchestrator.ts`, replacing the old regex-based
`symbol-index.ts` `formatRepoMap`.

### Current state (what to change)

In `src/orchestrator.ts`:
- Line 20: `import { buildSymbolIndex, formatRepoMap } from "./symbol-index.js";`
- Line 139: `const rankedFiles = rankFiles(workDir, 8);` — **keep this** for file selection
- Lines 147-156: builds `repoMapBlock` using `buildSymbolIndex` + old `formatRepoMap`
- Line 181: returns `{ systemPrompt, repoMapBlock }`

### What to do

1. **Replace import**: Change the `symbol-index.js` import to use `tree-sitter-map.js`:
   ```ts
   import { buildRepoMap, formatRepoMap } from "./tree-sitter-map.js";
   ```
   Remove the `buildSymbolIndex` import. Keep `rankFiles` import.

2. **Replace repoMapBlock construction** (lines ~147-156):
   ```ts
   // Use rankFiles to get file paths, then buildRepoMap for AST extraction
   const rankedPaths = rankedFiles.map(f => f.path);
   const repoMap = buildRepoMap(workDir, rankedPaths);
   const raw = formatRepoMap(repoMap, { onlyExported: true, maxFiles: 20 });
   if (raw.length > 50) {
     repoMapBlock = "\n\n" + (raw.length > 3000 ? raw.slice(0, 3000) + "\n…" : raw);
   }
   ```
   Note: bumped char limit from 2000→3000 since tree-sitter output is richer and worth the tokens.

3. **Update tests**: Any test in `src/__tests__/` that mocks or references `symbol-index.js`
   `formatRepoMap` must be updated to use the new import path. Check:
   - `src/__tests__/orchestrator*.test.ts`
   - `src/__tests__/architect-mode.test.ts`

4. **Do NOT delete `symbol-index.ts`** — it's still used by other modules. Just stop
   importing it in orchestrator.ts.

### Success criteria

- [ ] `npx tsc --noEmit` passes
- [ ] All 505+ tests pass
- [ ] `buildSystemPrompt()` uses tree-sitter-map's `buildRepoMap` + `formatRepoMap`
- [ ] Old `symbol-index.js` import removed from `orchestrator.ts`
- [ ] `rankFiles` still used for file selection (not removed)
- [ ] The repo map section in system prompt contains symbol kinds and line numbers (e.g. `foo (function:25)`)

### Out of scope
- No PageRank scoring yet
- No changes to tree-sitter-map.ts itself
- No TUI changes
- No new tools or features

Next expert (iteration 199): **Architect**
