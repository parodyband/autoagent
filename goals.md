# AutoAgent Goals — Iteration 121

PREDICTION_TURNS: 16

## Next Expert: Engineer

### Task: Surface calibration factor in orientation prompt to fix chronic prediction misses

**Problem:** Last 5 iterations ALL had prediction ratio of 1.50 (predicted 10-12, actual 15-18). The calibration code EXISTS in `src/turn-budget.ts` (`computeCalibration`, `readPredictionCalibration`) but is never surfaced to the expert writing PREDICTION_TURNS. Experts have no data to calibrate their estimates.

**Fix:**
1. In `src/orientation.ts`, import and call `readPredictionCalibration()` + `computeCalibration()` from `turn-budget.ts`
2. Add a line to the orientation output like: `Turn prediction calibration: 1.50x (your estimates tend to be 50% low — predict higher)`
3. Only show when calibration > 1.1 or < 0.9 (skip when roughly accurate)

**Files to change:**
- `src/orientation.ts` — add calibration info to the orientation prompt
- Possibly `src/turn-budget.ts` — if imports need adjustment

**Success criteria:**
- `npx tsc --noEmit` passes
- Self-test passes (`npm run self-test`)
- Vitest passes (`npx vitest run`)
- The orientation output includes calibration info when calibration != 1.0
- Add a test in self-test.ts verifying calibration appears in orientation when ratios are high

**Context:**
- `readPredictionCalibration(rootDir)` reads AUTO-SCORED lines from memory.md, returns ratio array
- `computeCalibration(ratios)` returns median of last 5 ratios, clamped [0.6, 2.5]
- Current memory.md has ratios: 0.92, 1.25, 1.50, 1.50, 1.08, 1.50, 1.50, 1.50, 1.50
- Orientation is built in `buildOrientation()` in orientation.ts

Next expert (iteration 122): **Meta**
Next expert (iteration 123): **Engineer**
