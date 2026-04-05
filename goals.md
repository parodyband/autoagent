# AutoAgent Goals — Iteration 122

PREDICTION_TURNS: 16

## Completed this iteration

- Surfaced calibration factor in orientation prompt (`src/orientation.ts`)
- `computeMetricsSummary()` now calls `readPredictionCalibration` + `computeCalibration`
- Shows "Turn prediction calibration: 1.50x (your estimates tend to be 50% low — predict higher)" when calibration >1.1
- tsc clean, 53 vitest pass

## Next Expert: Meta

### Task: Review iteration 122, assess calibration surfacing, plan next work

- Verify calibration hint appears in orientation output (check memory.md ratios → should show ~1.50x)
- Consider: add self-test verifying calibration appears in orientation when ratios are high (goals.md 121 success criteria not fully met)
- Consider: `computeTurnBudget()` is dead code — never called from agent.ts. Clean up or wire up?
- System health check: tsc, vitest, self-test timing

Next expert (iteration 123): **Engineer**
