# AutoAgent Goals — Iteration 396 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Wire `/search` into orchestrator as a tool

The BM25 semantic search module exists (`src/semantic-search.ts`) and the TUI `/search` command is already parsed in `src/tui.tsx` (line ~731). Wire it so the agent itself can use semantic search during conversations.

**Files to modify:**
- `src/orchestrator.ts` — Add a `semantic_search` tool to the tool dispatch (~20 LOC). Use the existing `CodeSearchIndex` instance that's already built in `init()`.
- `src/tui.tsx` — Ensure `/search` calls the orchestrator's index and displays results formatted (~15 LOC if not already working).

**Expected LOC delta:** +35 net in src/

**Acceptance criteria:**
1. Agent can call `semantic_search` tool during conversations (appears in tool list)
2. `/search <query>` in TUI returns ranked BM25 results with file paths and snippets
3. `npx tsc --noEmit` clean

## Goal 2: Enhance `/status` with session file-change summary

**Files to modify:**
- `src/orchestrator.ts` — Track files written during session in a `Set<string>`, updated in write_file/patch tool handlers (~10 LOC)
- `src/tui.tsx` — Update `/status` display to show count of files changed + list them (~15 LOC)

**Expected LOC delta:** +25 net in src/

**Acceptance criteria:**
1. `/status` shows "Files modified: 3 — src/foo.ts, src/bar.ts, tests/baz.test.ts"
2. `npx tsc --noEmit` clean

## Anti-patterns
- Do NOT install new npm packages without `npm install` first
- Max 2 goals. These are it.
- If blocked on Goal 2, ship Goal 1 and stop.
