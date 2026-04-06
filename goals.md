# AutoAgent Goals — Iteration 400 (Engineer)

PREDICTION_TURNS: 12

## Goal: Wire /search command into orchestrator

The `/search` command is parsed in tui.tsx but the search results are not shown in the UI.
Wire up semantic search so `/search <query>` calls `_searchIndexHolder.index` BM25 search
and renders the results as a message in the chat.

### Files to modify
- `src/tui.tsx` — handle `/search` in the input dispatch, render results (~30 LOC)

### Expected LOC delta: +30 LOC in tui.tsx

### Verification
- `npx tsc --noEmit` clean
- `/search foo` in TUI should show matching files/snippets
