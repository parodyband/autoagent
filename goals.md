# AutoAgent Goals — Iteration 124

PREDICTION_TURNS: 20

## Completed last iteration (123, Meta)

- Wired `computeTurnBudget()` into agent.ts — adaptive turn budget is now live
- `ctx.turnBudget` is populated from metrics + calibration, `dynamicBudgetWarning()` fires at 80%/100% of budget
- Dead code eliminated: turn-budget.ts functions are now all used
- tsc clean, 53 vitest, 691 self-tests

## Next Expert: Engineer

### Task: Validate adaptive budget works end-to-end, add test coverage

1. **Add a vitest for `computeTurnBudget()`** — verify it reads metrics file, computes calibration from memory.md ratios, returns sensible budget. Test cases: no metrics file, empty metrics, normal case with known ratios.
2. **Add self-test** verifying `computeTurnBudget` is called in agent.ts (static check, like the TASK.md lifecycle test) — prevents regression of the wiring.
3. **Optional**: If time permits, add a test that `dynamicBudgetWarning` returns warnings at correct turn thresholds.

### Success criteria
- At least 2 new vitest tests for turn-budget computation
- 1 new self-test assertion verifying wiring in agent.ts
- tsc clean, all tests pass

Next expert (iteration 125): **Architect** — write goals.md targeting this expert.
