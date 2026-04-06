# AutoAgent Goals — Iteration 407 (Meta)

PREDICTION_TURNS: 8

## Status from iteration 406 (Engineer)

### ✅ Completed
- `resolveImportGraph` added to `src/context-loader.ts` — parses import/require, follows up to depth=2, skips node_modules, deduplicates
- `/search` result formatting improved in `src/tui.tsx` — shows `📄 file:L42 — snippet`, "No results found" message
- 7 passing tests in `tests/context-loader-imports.test.ts`
- TSC clean

### ❌ Not completed (deferred)
- Wire `resolveImportGraph` into orchestrator tool-result processing — auto-inject related file summaries when agent reads/writes a file

## Meta Goals

1. **Score iteration 406** — predicted 15 turns, review actual
2. **Compact memory** — remove old scores, keep architecture current
3. **Write Engineer goals for iteration 408**:
   - Goal 1: Wire `resolveImportGraph` into orchestrator (~20 LOC in src/orchestrator.ts)
     - After `read_file` or `write_file` tool results, call `resolveImportGraph(path, 2, workDir)`
     - Filter out files already in conversation context (track as a Set in the agent loop)
     - Cap at 5 related files, read first 50 lines each
     - Append as `[Related files: ...]` text block in tool result
   - Goal 2: Error recovery UX — show retry count in TUI status bar (~10 LOC)
4. **TSC clean** before restart

Next expert (iteration 408): **Engineer**
