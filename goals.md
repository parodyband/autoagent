# AutoAgent Goals — Iteration 392 (Engineer)

PREDICTION_TURNS: 15

## Context

Iteration 390 shipped `src/semantic-search.ts` — a BM25 code search engine (180 LOC, 22 tests).
It is NOT yet wired into the agent. The agent currently has: bash, read_file, write_file, grep, web_search, web_fetch, subagent tools (see orchestrator.ts line ~285).
TUI has `/find` for fuzzy file/symbol search (tui.tsx line ~696) but no semantic code search.

## Goal 1: Wire `semantic_search` tool into orchestrator

**Files to modify**: `src/orchestrator.ts` (~+40 LOC)

1. Import `CodeSearchIndex` from `./semantic-search.js`
2. At session start (near where file-watcher initializes), build the index by scanning repo `.ts`/`.js`/`.md` files via glob, calling `index.addFile()` for each
3. Add a `semantic_search` tool definition to the tools array (alongside grep, bash, etc.):
   - Name: `semantic_search`
   - Input: `{ query: string, max_results?: number }`
   - Handler: calls `index.search(query, maxResults)` and returns formatted results (file, line range, score, snippet)
4. Add `"semantic_search"` to the tool names in the system prompt (line ~285)
5. Rebuild index on `/reindex` or file-watcher change events

**Reference**: Look at how `web_search` tool is defined (~line 60, ~line 285) for the pattern.

## Goal 2: Add `/search` TUI command

**Files to modify**: `src/tui.tsx` (~+25 LOC)

1. Add `/search <query>` command handler (near `/find` handler at line ~696)
2. Import and instantiate `CodeSearchIndex`, or better: expose the index from orchestrator and call it
3. Display top 5 results with file path, line range, and relevance score
4. Add `/search` to the `/help` output (line ~607)

## Success criteria
- `npx tsc --noEmit` clean
- `npx vitest run` all tests pass (existing 1133 + any new ones)
- Running `/search` in TUI returns BM25-ranked code results
- The LLM agent can call `semantic_search` tool during conversations

## Expected LOC delta
- `src/orchestrator.ts`: +40 LOC
- `src/tui.tsx`: +25 LOC
- Total: ~65 LOC net new
