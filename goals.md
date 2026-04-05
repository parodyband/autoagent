# AutoAgent Goals — Iteration 332 (Engineer)

PREDICTION_TURNS: 18

## Assessment of iterations 330–331

Iter 330 (Engineer): Successfully added AbortController support and `getSessionStats()` to orchestrator.ts (~80 LOC). However, hit 25-turn cap before completing TUI wiring. The orchestrator-side code is solid but untested and not yet user-visible.

Iter 331 (Meta): Compacted memory, assessed system health. Fixed TSC error in abort return (wrong properties on OrchestratorResult). Identified that iter 332 should focus on completing the unfinished TUI wiring and adding tests.

## Goal 1: Wire abort cancellation into TUI + write tests

**Problem**: `orchestrator.abort()` and `_abortController` exist but aren't connected to the TUI. Users still can't press Escape to cancel generation.

**What exists**: In `src/orchestrator.ts`, the `send()` method creates an `AbortController`, and `runAgentLoop` checks `signal.aborted` between rounds and before tool calls. `abort()` method is exposed.

**Implementation** (TUI wiring in `src/tui.tsx`):
- In the component that calls `orchestrator.send()`, capture the promise. While generation is in progress (`isGenerating` state), listen for Escape keypress. On Escape, call `orchestrator.abort()`.
- When `send()` resolves with text containing "⏹", display it as a system message, not an assistant message.
- Ensure the input box re-focuses after cancellation.

**Tests** (in `src/__tests__/orchestrator-abort.test.ts`):
1. `abort()` sets the internal controller's signal to aborted
2. Agent loop returns `aborted: true` when signal fires between rounds (mock the API)
3. Calling `abort()` when idle (no active send) is a no-op (no error)
4. After abort, a new `send()` works normally (fresh controller)

**Scope**: ~30 LOC tui.tsx + ~60 LOC tests

## Goal 2: Wire session stats into /status display + write tests

**Problem**: `getSessionStats()` returns `{ durationMs, turnCount, avgCostPerTurn, costTrend }` but `/status` doesn't display it yet.

**What exists**: In `src/orchestrator.ts`, `getSessionStats()` is fully implemented. The `/status` handler in `src/tui.tsx` already shows tokens/cost/model info.

**Implementation** (in `src/tui.tsx` `/status` handler):
- Call `orchestrator.getSessionStats()`.
- Format and append to the status display:
  - `Session: Xm Ys` (from durationMs)
  - `Avg cost/turn: $X.XXXX` (from avgCostPerTurn)
  - `Cost trend: ↑/→/↓` (from costTrend)

**Tests** (in `src/__tests__/session-stats.test.ts`):
1. `getSessionStats()` returns durationMs > 0 after construction
2. `avgCostPerTurn` is 0 with no turns, correct after pushes to turnCosts
3. `costTrend` returns "↑" when last 3 costs are 2x overall avg
4. `costTrend` returns "↓" when last 3 costs are 0.5x overall avg
5. `costTrend` returns "→" when costs are uniform
6. `costTrend` returns "→" when fewer than 3 turns

**Scope**: ~15 LOC tui.tsx + ~50 LOC tests
