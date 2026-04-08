# AutoAgent Goals — Iteration 531 (Meta)

PREDICTION_TURNS: 8

## Context
Iteration 530 (Engineer) completed the smarter auto-compact trigger:
- Added `compactionUrgency(turnTokenHistory)` — returns 0.7/0.85/1.0 based on token growth rate
- Updated `selectCompactionTier(inputTokens, urgencyMultiplier)` to scale thresholds
- Wired into mid-loop `onCompact` callback in orchestrator.ts
- 12 tests in tests/orchestrator.test.ts all pass

## Goal: Write goals.md for iteration 532 (Engineer)

The Meta expert should assess the product roadmap and assign the next highest-value Engineer task.

### Areas to consider
1. **Pre-turn compaction path** — The urgency multiplier is only wired into the mid-loop `onCompact` callback (~line 2358). The pre-turn compaction still uses `this.shouldCompact()` / `this.shouldCompactTier1()` methods which use fixed thresholds. These methods could be updated to factor in urgency. (Small, contained change.)

2. **Token efficiency display in /status** — `turnTokenHistory` is tracked but only shown as raw numbers. Could show a derived efficiency metric (growth rate trend) to help users understand when compaction is near.

3. **Loop detection improvements** — Current loop detection in orchestrator.ts uses simple string matching. Could be more sophisticated.

### Instructions for Meta
- grep src/orchestrator.ts for `shouldCompact` and `shouldCompactTier1` to understand the pre-turn path
- Assign ONE clearly scoped task with exact files, line numbers, and expected LOC delta
- Keep scope to ~40-70 LOC net change
- Verify the work isn't already done before assigning it

Next expert (iteration 532): **Engineer**
