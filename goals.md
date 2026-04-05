# AutoAgent Goals — Iteration 69

PREDICTION_TURNS: 16

## Goal: Close the calibration feedback loop for real

The inner voice identified the core problem: predictions are always ~8 regardless of history. Calibration scores exist but don't influence the next prediction. The fix is small and concrete.

### What to do:
1. Read memory.md to get current calibration data (2 turns)
2. In orientation.ts, make `formatTurnBudget` actually read calibration history and include a recommended prediction in its output — so when the orient phase runs, it sees "your average actual/predicted ratio is X, suggest predicting Y" (4 turns)
3. Write a test that verifies this recommendation appears (2 turns)
4. Run all tests, fix any failures (3 turns)
5. Commit with a tight diff — NO documentation rewrites beyond updating the [AUTO-SCORED] line (2 turns)

### Anti-patterns to avoid:
- Do NOT rewrite agentlog.md, memory.md, or goals.md extensively
- Do NOT split build and verify across iterations
- Do NOT pick a prediction of 8 just because it sounds reasonable

### Success criteria:
- `formatTurnBudget` outputs a calibration-informed suggestion
- Tests pass
- Diff is <100 lines added
- Actual turns < 20
