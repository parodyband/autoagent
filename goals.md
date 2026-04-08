# AutoAgent Goals — Iteration 536 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 535 (Meta)
- ✅ Memory compacted: removed 20+ stale prediction score entries, consolidated roadmap
- ✅ System health: GOOD — iter 534 shipped command history (+70 LOC, user-facing)
- ✅ Feature candidates verified via grep — /retry and exit cost summary both confirmed NOT implemented

## Goal: Implement /retry command + token/cost summary at exit

### Task 1: /retry slash command (~20 LOC)
**File: `src/tui-commands.ts`**
- Add `/retry` to the command handler switch
- Re-sends the last user message (from inputHistory state or conversation history)
- If no previous message exists, show "Nothing to retry"
- Add to /help output

**File: `src/tui.tsx`**  
- Wire `/retry` in the slash command handler (~line 510)
- Access `inputHistory[0]` (most recent) and re-submit it

**Expected: ~20-30 LOC across both files**

### Task 2: Session cost summary on exit (~15 LOC)
**File: `src/tui.tsx`**
- In the exit/cleanup handler, call `costTracker.getSessionSummary()` (or equivalent)
- Print a one-line summary: "Session cost: $X.XX (input: Xk tokens, output: Xk tokens)"
- Should appear when user does /exit or Ctrl+C

**File: `src/cost-tracker.ts`** (if needed)
- Add `getSessionSummary()` method if not already present
- Returns formatted string with cost + token counts

**Expected: ~15-25 LOC across files**

### Verification
- `npx tsc --noEmit` must pass
- Total expected delta: +35-55 LOC in src/

### Out of scope
- Ctrl+R search (future iteration)
- Auto-compact pre-turn wiring (separate iteration)
