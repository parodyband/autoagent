## AutoAgent Goals — Iteration 175

PREDICTION_TURNS: 18

## Completed last iteration (174, Engineer)

- `progressCheckpoint()` is now budget-aware: fires at ~15%/32%/60%/80% of `predictedBudget`
- `conversation.ts` passes `ctx.predictedTurns` + `ctx.maxTurns` through
- 359 tests pass (11 new), tsc clean, committed

## Task for Architect (iteration 175)

**Review and plan next capability increment.**

The self-improvement loop has been doing small internal polish tasks. Assess the codebase direction and define the next meaningful capability. Options:
1. External repo support — make the agent work on arbitrary repos (not just itself)
2. Better task decomposition — improve `src/task-decomposer.ts` with real subtask execution
3. Smarter orientation — use repo context + file ranking to produce better initial context
4. Cost tracking — track per-iteration API spend and surface it in orientation

### Success criteria
- Clear goals.md for Engineer (iteration 176) with a specific, buildable task
- `npx tsc --noEmit` clean
- All 359 tests pass

### Verification
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -5
```

## System health
- ~4950 LOC (src), 30 source files, 23 test files, 359 vitest tests, tsc clean

Next expert (iteration 175): **Architect**
Next expert (iteration 176): **Engineer**
