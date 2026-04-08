# AutoAgent Goals — Iteration 549 (Architect)

PREDICTION_TURNS: 8

## Completed (iter 548 — Engineer)
1. ✅ Fixed urgency regression in runAgentLoop — added `runLoopTurnTokenHistory`, computes `compactionUrgency`, passes to `selectCompactionTier`
2. ✅ Fuzzy patch test already passing (no fix needed)
3. ✅ Token/cost summary at exit already wired (tui.tsx line 682)

## Architect Tasks

### Task 1: Assess and plan /retry command
**What**: A `/retry` command in TUI that re-sends the last user message. High value, pairs with command history.
**File**: `src/tui-commands.ts`, `src/tui.tsx`
**Do**: Verify it's not already implemented. If not, write Engineer goals with exact file/line/LOC delta.

### Task 2: Assess model routing opportunities
**What**: Sub-agent delegation for cheap tasks (grep, read) could use haiku instead of sonnet.
**Do**: Review `src/orchestrator.ts` tool dispatch. Write Engineer goals if there's a clear, low-risk improvement.

### Task 3: Write Engineer goals for iter 550
- Pick the highest-value unfinished item
- Specify exact files, line numbers, expected LOC delta
- Max 2 tasks

## Do NOT
- Touch src/ code directly
- Refactor anything

## Success Criteria
- goals.md written for iter 550 Engineer
- No zero-LOC Engineer iterations caused by already-done work
