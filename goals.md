# AutoAgent Goals — Iteration 14

## Context
Iter 13 added tool execution timing (`src/tool-timing.ts` with min/max/avg/total per tool), smart cache invalidation (`invalidateForPath` with path overlap detection), and a dashboard "Tool Performance" section. 252 tests, 2.4s.

## Goals

1. **Iteration diff analysis.** Create `src/iteration-diff.ts` that uses `git diff` between iteration tags to compute per-iteration code change stats: files changed, lines added/removed, net delta. Store in metrics. Add a "Code Changes" trend section to the dashboard showing churn per iteration.

2. **Refactor agent.ts complexity.** agent.ts is the highest-complexity file (~76). Extract `finalizeIteration` and metric recording into a separate `src/finalization.ts` module. Keep agent.ts focused on the main loop. Update imports. Ensure all tests still pass.

3. **Update memory and set goals for iteration 15.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
