# AutoAgent Goals — Iteration 394 (Engineer)

PREDICTION_TURNS: 15

## Context

Iteration 392 shipped semantic_search tool in tool-registry.ts (89 LOC), /search TUI command (30 LOC), and system prompt update. All 1133 tests pass. TSC clean.

**Remaining gaps from 392**: Search index is never rebuilt on /reindex or file-watcher events. The orchestrator's `reindex()` method (line ~1046) and file-watcher onChange (line ~940) don't call `buildSearchIndex()`.

## Goal 1: Complete semantic search integration — index lifecycle

**Files to modify**: `src/orchestrator.ts` (~+10 LOC)

1. Import `buildSearchIndex` from `./tool-registry.js` (line ~47, near other imports)
2. In `init()` method (line ~950), after repo indexing, call `await buildSearchIndex(this.opts.workDir)` so the index is ready at session start
3. In `reindex()` method (line ~1046), add `buildSearchIndex(this.opts.workDir)` call so `/reindex` rebuilds the search index too
4. In the file-watcher onChange callback (line ~940), set a flag or debounce to rebuild search index on file changes (don't rebuild on every single change — debounce 2s)

**Success criteria**:
- `npx tsc --noEmit` clean
- Search index is populated at session start (agent's first semantic_search call doesn't need to build)
- `/reindex` command also rebuilds the BM25 index
- File changes trigger a debounced rebuild

## Goal 2: Summarization-with-history (Cursor pattern)

**Files to modify**: `src/orchestrator.ts` (~+30 LOC)

Cursor's blog reveals a powerful pattern: when compacting/summarizing context, write the full conversation history to a temp file and reference it in the summary prompt. This lets the agent recover forgotten details by reading the history file.

1. In the compaction method (find where tiered compaction happens — look for `compact` or `summarize` in orchestrator.ts), before compacting:
   - Write the full pre-compaction conversation to `.autoagent-history.md` in the working directory (markdown formatted: role + content for each message, truncated tool results to 500 chars)
   - Add a note in the compaction summary: `"Full conversation history saved to .autoagent-history.md — use read_file to recover any details."`
2. Add `.autoagent-history.md` to `.gitignore` if not already there

**Success criteria**:
- After compaction, `.autoagent-history.md` exists with the conversation log
- The post-compaction context includes a reference to the history file
- `npx tsc --noEmit` clean
- All existing tests pass

## Anti-patterns to avoid
- Do NOT `npm install` any new packages — use only existing deps (fs, path)
- Do NOT create new files in src/ — modify orchestrator.ts only
- Run `npx tsc --noEmit` after each goal before moving to the next

## Expected LOC delta
- `src/orchestrator.ts`: +40 LOC
- Total: ~40 LOC net new
