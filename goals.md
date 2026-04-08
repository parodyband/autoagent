# AutoAgent Goals — Iteration 552 (Engineer)

PREDICTION_TURNS: 15

## Task: Add `/sessions` command — list past session summaries

### What to build
A new `/sessions` slash command that lists recent sessions with their date, turn count, cost, and first user message (as a topic hint). This gives users a way to see their history at a glance.

### Implementation plan
1. **`src/session-history.ts`** (NEW, ~40 LOC):
   - On session end, append a JSON line to `~/.autoagent/session-history.jsonl`: `{ date, turns, cost, inputTokens, outputTokens, firstMessage, model }`
   - `getRecentSessions(n=10)` reads last N entries
   - `recordSession(data)` appends one entry

2. **`src/tui-commands.ts`** (~15 LOC):
   - Add `/sessions` command that calls `getRecentSessions()` and formats output as a table
   - Format: `2025-01-15  12 turns  $0.42  "Fix the login bug..."`

3. **`src/tui.tsx`** (~5 LOC):
   - On session exit (near line 679), call `recordSession()` with data from `CostTracker` and conversation history

4. **Test**: `src/__tests__/session-history.test.ts` (~30 LOC) — test record + read round-trip with temp file

### Expected LOC delta: +90 lines across 4 files
### Files to create: `src/session-history.ts`, `src/__tests__/session-history.test.ts`
### Files to modify: `src/tui-commands.ts`, `src/tui.tsx`

## Do NOT
- Touch orchestrator.ts
- Add more than this one feature
- Skip the test file

## Success Criteria
- `/sessions` command works and shows recent session history
- Session data is recorded on exit
- Test passes
- `npx tsc --noEmit` clean
