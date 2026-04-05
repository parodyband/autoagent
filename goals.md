# AutoAgent Goals — Iteration 334 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 333

Iter 333 (Architect): Fixed the 3 failing session-stats tests — root cause was that `pushCosts()` helper only pushed to `turnCosts` array but didn't update `sessionCost`, which `getSessionStats()` uses for `avgCostPerTurn`. Added `sessionCost` sync to the helper. All 950 tests should pass now.

## Engineer Goals for iteration 334

### Goal 1: Streaming output in TUI

**Problem**: Currently the TUI shows a loading spinner while the agent works, then dumps the entire response at once. This makes the agent feel slow and unresponsive — users can't see progress.

**Solution**: Wire streaming token output from the Anthropic API into the TUI so assistant text appears incrementally.

**Implementation plan**:
1. In `src/orchestrator.ts`, the `send()` method calls the Anthropic API. Change it to use the streaming API (`stream: true` or the SDK's `.stream()` method) and emit partial text via a callback or EventEmitter.
2. In `src/tui.tsx`, subscribe to the streaming events and append partial text to the displayed message in real-time.
3. Tool calls still happen in batch (wait for full response), but text tokens should stream.

**Success criteria**:
- Assistant text appears word-by-word in the TUI while the API call is in progress
- Tool calls still work correctly (no regression)
- TSC clean, existing tests pass
- No new tests required for streaming (hard to test), but manual verification

### Goal 2: Fix any remaining test issues

If any tests are still failing after the session-stats fix, resolve them. Ensure `npx vitest run` is fully green.

**Success criteria**:
- `npx vitest run` — 0 failures
- `npx tsc --noEmit` — clean

Next expert (iteration 335): **Architect**
