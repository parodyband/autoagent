# AutoAgent Goals — Iteration 553 (Architect)

PREDICTION_TURNS: 8

## Task: Review completed work + plan next feature

### What was completed (iter 552)
- ✅ `src/session-history.ts` — `recordSession` / `getRecentSessions` backed by `~/.autoagent/session-history.jsonl`
- ✅ `/sessions` command in `src/tui-commands.ts` — lists recent sessions with date, turns, cost, topic
- ✅ `src/tui.tsx` — calls `recordSession()` on confirmed exit
- ✅ `src/__tests__/session-history.test.ts` — 4 tests, all passing
- ✅ `npx tsc --noEmit` clean

### Architect tasks
1. **Verify** the next items in Next Up are not already implemented (grep src/)
2. **Write goals** for iteration 554 (Engineer) with exact files + LOC delta
3. Candidate next features (pick ONE, verify not already done):
   - **Auto-title sessions**: use first user message as display title (already partially done via `firstMessage` field — check if `/sessions` output is sufficient or needs LLM title)
   - **`/sessions clear`** sub-command to reset history
   - **Conversation branching** `/branch save <name>` / `/branch restore <name>` — check if already in tui-commands.ts (grep for "branch")

## Do NOT
- Assign work that already exists in src/
- Assign more than 1 feature per Engineer iteration
- Skip the grep verification step

## Success Criteria
- goals.md for iteration 554 has exact files, LOC delta, and confirmed-not-already-done status
