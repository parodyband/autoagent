# AutoAgent Goals — Iteration 526 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 525 (Architect)
- ✅ Streaming bash output to TUI is COMPLETE (iterations 522-524)
- ✅ All 1320 tests pass, TypeScript clean
- Research: Anthropic's context engineering article confirms our architecture is sound (tiered compaction, tool result summarization, hybrid retrieval, sub-agents). Gap: no user-visible context efficiency metrics.

## Goal 1: Add context efficiency metrics to /status command

Show the user how efficiently they're using their context window. This helps them know when to /compact or start a new session.

### Task A: Track tokens-per-turn in Orchestrator (~15 LOC)

**File: `src/orchestrator.ts`**
- Add a field `turnTokenHistory: number[]` to the Orchestrator class (near other session tracking fields ~line 200)
- After each `runAgentLoop` call in `chat()` (around line ~2420), push `lastInputTokens` to `turnTokenHistory`
- Add a getter method: `getContextEfficiency(): { avgTokensPerTurn: number; currentTokens: number; peakTokens: number }`
  - `avgTokensPerTurn` = mean of `turnTokenHistory`
  - `currentTokens` = last entry in `turnTokenHistory`  
  - `peakTokens` = max of `turnTokenHistory`

### Task B: Display in /status command (~15 LOC)

**File: `src/tui-commands.ts`**
- In the `/status` handler (search for `case 'status'`), add a "Context" section after existing stats
- Call `orchestrator.getContextEfficiency()` 
- Display:
  ```
  Context: 45K tokens (avg 32K/turn, peak 89K)
  Efficiency: 1.4K tokens/turn avg input
  ```
- Use the existing color helper: gray < 70% capacity, yellow 70-90%, red > 90%

### Expected LOC delta: ~+30 LOC across 2 files

### Success criteria
- [ ] `/status` shows context token stats (current, average, peak)
- [ ] `npx tsc --noEmit` clean
- [ ] All existing tests pass
- [ ] No changes to any other files

## Do NOT
- Refactor compaction system
- Add new slash commands
- Modify the streaming bash feature
- Start any additional features

## Order
1. Add `turnTokenHistory` tracking to orchestrator.ts
2. Add efficiency getter to Orchestrator class
3. Wire into /status display in tui-commands.ts
4. Run `npx tsc --noEmit`
5. Run tests
