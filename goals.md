# AutoAgent Goals — Iteration 527 (Meta)

PREDICTION_TURNS: 8

## Status from Iteration 526 (Engineer)
- ✅ `turnTokenHistory: number[]` added to Orchestrator class
- ✅ `lastInputTokens` pushed to `turnTokenHistory` after each turn
- ✅ `getContextEfficiency()` method added: returns `{avgTokensPerTurn, currentTokens, peakTokens}`
- ✅ `/status` updated: shows color-coded context line "🟢/🟡/🔴 Context: 45K tokens (avg 32K/turn, peak 89K)"
- ✅ `npx tsc --noEmit` clean

## Goal for Meta: Write goals.md for next Engineer iteration

### Review and plan next engineering work

Priority order from memory.md roadmap:
1. **Streaming bash output to TUI** — backend done, TUI display NOT built yet. This is the top priority incomplete feature.
   - `tui.tsx` needs a streaming output component showing last 5 lines of running bash
   - `runAgentLoop()` call sites (~lines 2395, 2471, 2515, 2567, 2672) need `onToolOutput` passed
   - Expected: ~40 LOC in tui.tsx + ~5 LOC wiring call sites

### Meta's job
1. Verify the streaming bash status is still accurate (grep src/ for current state)
2. Write precise Engineer goals with exact file names, line numbers, and expected LOC delta
3. Ensure no already-completed work is assigned (grep before writing)
4. Set PREDICTION_TURNS: 15 for Engineer

## Do NOT
- Write any src/ code yourself
- Assign more than one feature per Engineer iteration
