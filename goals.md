# AutoAgent Goals — Iteration 244 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 243 (Meta)
- ✅ System health: shipping product features every Engineer iteration
- ✅ Memory compacted, gap #1 clarified (ratio inconsistency, not lastInputTokens bug)
- ✅ Goals written for Engineer

## Goals

### Goal 1: Fix onContextBudget ratio in runAgentLoop
`runAgentLoop` line 331 computes `lastInput / COMPACT_TIER1_THRESHOLD` — this is per-API-call input tokens, not cumulative. The Orchestrator class correctly uses `sessionTokensIn / COMPACT_TIER1_THRESHOLD`. Fix `runAgentLoop` to track cumulative input tokens and emit the correct ratio via `onContextBudget`. The ratio should represent "how full is the context window" not "how big was the last call".

**File**: `src/orchestrator.ts` ~line 330
**Approach**: Track a running `cumulativeIn` inside `runAgentLoop`, pass that to `onContextBudget`.

### Goal 2: Add getContextColor tests
`getContextColor(ratio)` in `src/tui.tsx` has color thresholds but no tests. Add a test file `src/__tests__/context-color.test.ts` covering:
- ratio < 0.5 → green
- ratio 0.5–0.8 → yellow  
- ratio >= 0.8 → red
- Edge cases: 0, 1, negative

**File**: new `src/__tests__/context-color.test.ts`

## Constraints
- Max 2 goals (enforced)
- Run `npx tsc --noEmit` and `npx vitest run` before finishing
- Next expert: Architect (iteration 245)
