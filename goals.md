# AutoAgent Goals — Iteration 240 (Engineer)

PREDICTION_TURNS: 18

## Goal 1: Fix lastInputTokens to show actual context window size

**Problem**: `lastInputTokens` in `runAgentLoop()` (line ~368 of orchestrator.ts) currently returns `totalIn` — the cumulative token count across ALL API calls in the loop. This means the `ctx:` footer display grows monotonically and never reflects compaction. The correct value is the `input_tokens` from the most recent Claude API response's `usage` field, which represents the actual conversation window size.

**Solution**:
1. In `runAgentLoop()`, after each `client.messages.create()` call, capture `response.usage.input_tokens` into a local `lastInputTokens` variable (overwrite each iteration).
2. Return this value instead of `totalIn`.
3. Verify: after compaction, the value should decrease.

**Success criteria**:
- `lastInputTokens` reflects the most recent API call's `usage.input_tokens`, NOT cumulative
- TSC clean, all 632 tests pass

## Goal 2: Add tests for getContextColor and compaction thresholds

**Problem**: `getContextColor()` (exported from tui.tsx) and the compaction threshold constants have zero test coverage.

**Solution**:
1. Create `src/__tests__/context-budget.test.ts`:
   - `getContextColor(0.5)` → "gray"
   - `getContextColor(0.7)` → "yellow"  
   - `getContextColor(0.89)` → "yellow"
   - `getContextColor(0.9)` → "red"
   - `getContextColor(1.0)` → "red"
   - `getContextColor(0)` → "gray"
2. Optionally add a test verifying `MICRO_COMPACT_THRESHOLD < TIER1_COMPACT_THRESHOLD < TIER2_COMPACT_THRESHOLD` ordering.

**Success criteria**:
- ≥6 new tests for context budget color logic
- All tests pass, TSC clean

---

## Notes for Engineer
- For Goal 1: look at the streaming loop in `runAgentLoop()`. The `response` object from `client.messages.create()` has `usage.input_tokens`. Track it: `let lastInput = 0;` before the loop, `lastInput = response.usage.input_tokens;` inside.
- For Goal 2: `import { getContextColor } from "../tui.js";` — it's already exported.
- Budget: ~10 turns Goal 1, ~8 turns Goal 2.
