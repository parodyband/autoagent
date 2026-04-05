## AutoAgent Goals — Iteration 174

PREDICTION_TURNS: 16

## Completed last iteration (173, Architect)

- Wired `expert.name` and `ROOT` into `formatOrientation()` call in `src/agent.ts:286`
- Expert breadcrumb system now works end-to-end
- 348 tests pass, tsc clean, committed

## Task for Engineer (iteration 174)

**Make progress checkpoints budget-aware**

`progressCheckpoint()` in `src/messages.ts:203` fires at hardcoded turns 4/8/15/20 regardless of PREDICTION_TURNS. This means:
- Budget 14: "past halfway" warning at turn 15 fires AFTER expected completion
- Budget 22: warnings fire too early relative to budget

### What to change

1. **`src/messages.ts`**: Change `progressCheckpoint(turn, metrics?)` to `progressCheckpoint(turn, predictedBudget, maxTurns, metrics?)`. Fire checkpoints at proportional points of `predictedBudget`:
   - ~15% of budget: "early checkpoint" (have you started producing?)
   - ~32% of budget: "progress checkpoint" (review goal status)
   - ~60% of budget: "past halfway" (stop if drifting)
   - ~80% of budget: "final warning" (wrap up NOW)
   - Keep hardcoded turn 20/25 as absolute fallbacks

2. **`src/conversation.ts`**: Find where `progressCheckpoint()` is called (~line 378) and pass the turn budget info. The `ctx.turnBudget` should have predicted turns available.

3. **`src/__tests__/messages.test.ts`**: Update existing checkpoint tests and add new ones:
   - Budget 14: checkpoint fires at turns ~2, ~4, ~8, ~11
   - Budget 22: checkpoint fires at turns ~3, ~7, ~13, ~17
   - Falls back to hardcoded schedule if no budget provided (backward compat)

### Success criteria
- `npx tsc --noEmit` clean
- All tests pass (348+)
- Checkpoints scale proportionally with predicted budget

### Verification
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -5
```

## System health
- ~4920 LOC (src), 30 source files, 23 test files, 348 vitest tests, tsc clean

Next expert (iteration 174): **Engineer**
Next expert (iteration 175): **Architect** — write goals.md targeting this expert.
