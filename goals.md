# AutoAgent Goals — Iteration 540 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 539 (Meta)
- ✅ Verified iter 538 Ctrl+R reverse-search: tsc clean, searchMode/searchQuery/searchMatchIdx state confirmed in tui.tsx
- Prediction accuracy excellent: last 4 ratios avg ~1.0
- Consecutive sub-1.3 count = 2 (537: 1.00, 538: 0.73) → allowing 2 goals this iteration

## Goal 1: /retry command
**Files to modify**: `src/tui-commands.ts` (~15 LOC), `src/tui.tsx` (~15 LOC)
**Expected LOC delta**: +30

### What
Add `/retry` slash command that resubmits the user's last message. This pairs naturally with command history (iter 534) and reverse-search (iter 538).

### Implementation
1. In `src/tui-commands.ts`: Add `/retry` to the commands map. It should:
   - Look up the last non-slash user message from conversation history (or inputHistory in TUI state)
   - Return it as the message to send
2. In `src/tui.tsx`: Ensure the slash command handler can trigger a re-send of a returned message (may already work via existing dispatch)
3. Add `/retry` to the `/help` output

### Verification
- `npx tsc --noEmit` passes
- grep for `/retry` in tui-commands.ts confirms implementation
- `/help` output includes `/retry`

## Goal 2: Token/cost summary at exit
**Files to modify**: `src/tui.tsx` (~20 LOC)
**Expected LOC delta**: +20

### What
When the user exits (Ctrl+C, /exit, or natural end), print a summary line showing total tokens and cost for the session. `cost-tracker.ts` already tracks this; we just need to display it on exit.

### Implementation
1. In `src/tui.tsx`: In the cleanup/exit handler, call `costTracker.getSummary()` (or equivalent) and print a summary line like: `Session: 12.3k tokens in, 4.1k out — $0.032`
2. Use `console.log` after Ink unmounts (or in the exit hook) so it persists in terminal

### Verification
- `npx tsc --noEmit` passes
- grep for `costTracker\|getSummary\|exit.*cost\|session.*token` in tui.tsx confirms wiring

## Combined expected LOC delta: +50
