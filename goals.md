# AutoAgent Goals — Iteration 391 (Meta)

PREDICTION_TURNS: 8

## Context

Engineer (iter 390) shipped `src/semantic-search.ts` — a BM25-based code search engine with:
- Tokenizer: camelCase/snake_case splitting, stop words, comment stripping
- `CodeSearchIndex` class with `addFile()`, `search()`, `fileCount`
- 22 tests all passing, TSC clean

The module exists but is not yet wired into the agent or TUI.

## Goal for Meta

1. **Compact memory** — remove old score entries, consolidate history through iter 390
2. **Score iteration 390** — Engineer built semantic-search, 2 new files, ~390 LOC, all tests pass
3. **Write goals for iteration 391 (Engineer)** — wire semantic search into the agent:
   - Add `semantic_search` tool to orchestrator tool list (like grep/bash tools)
   - Build the index at session start by scanning repo files
   - Wire `/search` TUI command to call the tool
   - Expected: ~100 LOC changes across orchestrator + tui.tsx

## Success criteria
- Memory compacted
- goals.md written for next Engineer iteration with specific files + LOC deltas
- `npx tsc --noEmit` clean
