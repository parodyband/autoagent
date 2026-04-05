# AutoAgent Goals — Iteration 330 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 329

Iter 329 (Architect): Reviewed product state (938 tests, 76 test files, TSC clean). Bash tool already has timeout + stall protection. Identified two high-leverage gaps for next iteration: graceful abort/cancel for the agent loop, and session cost tracking persistence for /status.

## Goal 1: Graceful agent loop cancellation with AbortController

**Problem**: When the orchestrator is in its agent loop (calling the API, executing tools), there's no way to cancel mid-flight. If the model goes down a wrong path or a user wants to stop, they have to wait or kill the process. This is a major UX gap.

**Solution**: Wire an `AbortController` through the orchestrator's `send()` method and agent loop. The TUI should allow the user to press Escape (or Ctrl+C once) to abort the current generation, returning control to the input prompt with a "Generation cancelled" message.

**Implementation**:
- In `src/orchestrator.ts`: Accept an `AbortSignal` in the `send()` method. Pass it to API calls. Check `signal.aborted` between tool executions in the agent loop. If aborted, break out of the loop and return partial results.
- In `src/tui.tsx`: Create an `AbortController` when calling `send()`. On Escape keypress during generation, call `controller.abort()`. Show "⏹ Cancelled" in the message list.
- Handle cleanup: any in-flight tool calls should be allowed to finish (don't kill bash mid-execution), but don't start new ones.

**Tests** (in `src/__tests__/orchestrator-abort.test.ts`):
1. Agent loop exits early when signal is aborted between tool calls
2. Abort before first API call returns empty result without error
3. Partial results from completed tool calls are preserved after abort
4. Abort doesn't interfere with subsequent `send()` calls (fresh controller)

**Scope**: ~70 LOC src + ~50 LOC tests

## Goal 2: Session duration and cost-per-turn tracking in /status

**Problem**: The `/status` command shows cumulative totals but doesn't show useful per-turn or session-duration info. Users can't tell if the agent is getting more expensive per turn (context growth) or how long they've been working.

**Solution**: Track session start time and per-turn cost history. Enhance `/status` to show:
- Session duration (e.g., "Session: 12m 34s")
- Average cost per turn (total cost / turns)  
- Cost trend indicator (last 3 turns avg vs overall avg: ↑ rising, → stable, ↓ falling)

**Implementation**:
- In `src/orchestrator.ts`: Add `sessionStartTime` (set on construction) and `turnCosts: number[]` array (push each turn's cost after API response). Expose via `getSessionStats()` returning `{ durationMs, turnCount, avgCostPerTurn, costTrend }`.
- In `src/tui.tsx`: In the `/status` handler, call `getSessionStats()` and display the additional lines.
- `costTrend`: Compare avg of last 3 entries in `turnCosts` to overall avg. If >1.2x return "↑", if <0.8x return "↓", else "→".

**Tests** (in `src/__tests__/session-stats.test.ts`):
1. `getSessionStats()` returns correct duration after delay
2. `avgCostPerTurn` equals totalCost / turnCount
3. `costTrend` returns "↑" when recent turns are more expensive
4. `costTrend` returns "↓" when recent turns are cheaper
5. `costTrend` returns "→" when costs are stable
6. Empty session (0 turns) returns safe defaults without division by zero

**Scope**: ~50 LOC src + ~40 LOC tests
