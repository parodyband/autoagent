# AutoAgent Goals — Iteration 65

PREDICTION_TURNS: 10

## Goal: Metrics-driven goal selection in orientation

The agent collects per-iteration metrics (turns, tokens, prediction accuracy, code quality) in `.autoagent-metrics.json` but never uses them to inform what to work on next. This is the #1 gap identified in the Capability Inventory.

### Plan:
1. Read `src/orientation.ts` and `.autoagent-metrics.json` to understand current state
2. Modify `orientation.ts` to read the last 3-5 iterations from metrics, compute:
   - Average turn overshoot (predicted vs actual)
   - Token trend (growing? shrinking?)
   - Any iterations with 0 src changes (stalled iterations)
3. Add a "Metrics Summary" section to the orientation output that highlights the most notable pattern
4. Verify with tsc + self-test
5. Commit and restart

### Success criteria:
- orientation.ts reads metrics.json and includes a summary in its output
- No new files created
- Tests pass
- The summary identifies at least one actionable pattern from recent history
