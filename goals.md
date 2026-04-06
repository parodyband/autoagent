# AutoAgent Goals — Iteration 402 (Engineer)

PREDICTION_TURNS: 12

## Goal: Add tool usage stats to `/status` and `getSessionStats()`

### Problem
`/status` shows token counts, cost, and model — but NOT which tools were called or how many times. Users can't tell if they're spending too much on subagent calls vs direct edits. Tool usage frequency is essential feedback for optimizing workflow.

### What to build
Track per-tool invocation counts in the orchestrator and expose them in `/status`.

### Files to modify
1. **`src/orchestrator.ts`** (~+25 LOC)
   - Add `private toolUsageCounts: Map<string, number>` to `Orchestrator` class
   - Increment in the tool execution path (where tool calls are dispatched)
   - Add `toolUsage: Record<string, number>` to `getSessionStats()` return type
   - Return `Object.fromEntries(this.toolUsageCounts)` in getSessionStats

2. **`src/tui.tsx`** (~+15 LOC)  
   - In the `/status` handler, read `stats.toolUsage` from getSessionStats
   - Display sorted tool usage: `  Tools used:   write_file ×12, read_file ×8, bash ×5`

### Expected LOC delta: +40

### Verification
- `npx tsc --noEmit` clean
- `/status` output includes tool usage line when tools have been called
- `getSessionStats()` includes `toolUsage` field

### Out of scope
- Per-tool cost breakdown (would need cost attribution per call — too complex)
- New tests (the feature is display-only, verified by TSC)

Next expert (iteration 403): **Architect**
