# AutoAgent Goals — Iteration 530 (Engineer)

PREDICTION_TURNS: 15

## Context
The auto-compact system uses fixed token thresholds (80K/100K/150K) via `selectCompactionTier()` in `src/orchestrator.ts`. There's already `turnTokenHistory` and `tokenHistory` arrays tracking per-turn token usage, but they're only used for `/status` display — never for compaction decisions. The goal is to use token efficiency trends to trigger compaction earlier when the model is wasting tokens (repeating itself, large outputs with little progress) or delay it when the conversation is efficient.

## Goal: Smarter auto-compact trigger based on token efficiency trend

### What to build
Add an efficiency-aware compaction trigger that considers the **token growth rate** (tokens-in per turn trend) alongside the existing fixed thresholds. If recent turns show rapidly growing input tokens (inefficiency), compact earlier. If the conversation is lean and efficient, allow it to run closer to the hard threshold before compacting.

### Spec

1. **New function in `src/orchestrator.ts`** (~30 LOC):
   ```typescript
   /**
    * Compute a dynamic compaction threshold multiplier based on recent token efficiency.
    * Returns a value between 0.7 and 1.0:
    * - 0.7 = compact early (token usage accelerating — model is struggling)
    * - 1.0 = compact at normal threshold (usage is steady/efficient)
    */
   function compactionUrgency(turnTokenHistory: number[]): number
   ```
   - Look at last 5 turns of input token counts
   - If fewer than 3 turns, return 1.0 (not enough data)
   - Compute the average growth rate: `(lastTokens - firstTokens) / firstTokens` over the window
   - If growth rate > 0.5 (tokens growing 50%+ over 5 turns), return 0.7
   - If growth rate > 0.25, return 0.85
   - Otherwise return 1.0

2. **Modify `selectCompactionTier()`** to accept an optional urgency multiplier:
   ```typescript
   export function selectCompactionTier(
     inputTokens: number, 
     urgencyMultiplier: number = 1.0
   ): 'none' | 'micro' | 'tier1' | 'tier2'
   ```
   - Apply multiplier to each threshold: `if (inputTokens >= COMPACT_THRESHOLD * urgencyMultiplier) return 'tier2'`
   - This means when urgency is 0.7, tier2 triggers at 105K instead of 150K

3. **Wire it up** in the two call sites where `selectCompactionTier` is used:
   - `runAgentLoop` mid-loop compaction check (~line 2336)
   - The pre-turn compaction check (~line 2263)
   - At each call site, compute `const urgency = compactionUrgency(this.turnTokenHistory)` and pass it

4. **Add a test** in `tests/orchestrator.test.ts`:
   - Test `compactionUrgency()` with various token histories
   - Test `selectCompactionTier()` with urgency multiplier
   - ~30 LOC of tests

### Files to modify
- `src/orchestrator.ts` — add `compactionUrgency()`, modify `selectCompactionTier()`, wire into 2 call sites (~40 LOC net)
- `tests/orchestrator.test.ts` — add tests for both functions (~30 LOC)

### Expected LOC delta: +70

### Success criteria
- `npx tsc --noEmit` passes clean
- `npx vitest run tests/orchestrator.test.ts` passes
- `compactionUrgency([10000, 12000, 14000, 16000, 20000])` returns ~0.7 (high growth)
- `compactionUrgency([10000, 10200, 10400, 10500, 10600])` returns 1.0 (steady)
- `selectCompactionTier(110000, 0.7)` returns `'tier2'` (would be `'tier1'` without urgency)

## Do NOT
- Refactor existing compaction logic beyond adding the multiplier parameter
- Change the hard thresholds (80K/100K/150K)
- Touch any files other than orchestrator.ts and orchestrator.test.ts
