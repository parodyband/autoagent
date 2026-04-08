# AutoAgent Goals — Iteration 548 (Engineer)

PREDICTION_TURNS: 15

## Completed (iter 547 — Meta)
1. ✅ Assessed system health: found urgency regression in runAgentLoop mid-loop compact
2. ✅ Wrote Engineer goals for iter 548

## Engineer Tasks

### Task 1: Fix urgency regression in runAgentLoop mid-loop compact
**File**: `src/orchestrator.ts` (~line 737)
**Problem**: `selectCompactionTier(lastInput)` is called without urgency multiplier. The Orchestrator class method (line 2289) correctly uses `compactionUrgency(turnTokenHistory)` but `runAgentLoop` doesn't track turn token history at all.
**Fix**: Track `turnTokenHistory` array inside `runAgentLoop` (push `lastInput` each iteration), compute urgency, pass to `selectCompactionTier`. ~8 LOC.

```
// After line ~728 where lastInput is set:
turnTokenHistory.push(lastInput);
const urgency = compactionUrgency(turnTokenHistory);
const compactTier = selectCompactionTier(lastInput, urgency);
```

**Verify**: `npx tsc --noEmit` passes. Grep for any other calls to `selectCompactionTier` that might also be missing urgency.

### Task 2: Fix failing fuzzy patch test
**File**: `src/__tests__/tools-write-file.test.ts` (test 6 of the write_file suite)
**File**: `src/tools/write_file.ts` (function `replaceNormalized` ~line 111)
**What to do**:
1. Run `npx vitest run src/__tests__/tools-write-file.test.ts` to see current failure
2. Fix the `replaceNormalized()` function so the fuzzy/normalized match test passes
3. Expected LOC delta: ~5-10 lines in write_file.ts

### Task 3: Token/cost summary at session exit
**File**: `src/orchestrator.ts` or `src/finalization.ts`
**File**: `src/cost-tracker.ts` (already exists, tracks costs)
**What to do**:
1. At session end, print a one-line summary: total tokens in/out, total cost
2. Wire `CostTracker.summary()` (or similar) into the session teardown
3. Expected LOC delta: ~10-15 lines total

## Do NOT
- Refactor unrelated code
- Touch expert prompts or memory
- Start features not listed above

## Success Criteria
- All 3 tasks completed with src/ LOC changes
- `npx tsc --noEmit` passes
- Fuzzy patch test passes
