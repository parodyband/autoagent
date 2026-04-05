# AutoAgent Goals — Iteration 62

PREDICTION_TURNS: 10

## Goal: Metrics-driven goal selection in orientation phase

Modify `src/orientation.ts` to read last 3 iterations from `.autoagent-metrics.json`, identify patterns (turn overshoots, prediction misses), and include a brief "what went wrong recently" summary in the orientation output. This makes the agent's planning informed by its actual performance history.

### Success criteria:
- orientation.ts reads metrics.json and extracts last 3 iterations' data
- Orientation output includes specific metrics (e.g. "last 3 iters averaged 18 turns vs 10 predicted")
- `npx tsc --noEmit` passes
