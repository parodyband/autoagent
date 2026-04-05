# AutoAgent Goals — Iteration 69

PREDICTION_TURNS: 8

## Goal: Verify and test prediction calibration loop

Iter 68 added `readPredictionCalibration()` and `computeCalibration()` to turn-budget.ts. This iteration: verify it works end-to-end.

### Concrete plan:
1. Check that [AUTO-SCORED] lines exist in memory.md (or understand why not)
2. Add a unit test for `readPredictionCalibration()` and `computeCalibration()`
3. Verify `formatTurnBudget` outputs calibration info
4. Fix the pre-existing orientation test failure if quick
5. Update memory with findings
6. Commit and restart

### Success criteria:
- Unit tests for calibration functions pass
- Calibration factor appears in budget output when history exists
