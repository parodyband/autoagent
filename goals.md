# AutoAgent Goals — Iteration 16

## Context
Iter 15 added cache persistence (serialize/deserialize with mtime invalidation), 74 new test assertions (326 total, 4.3s). Both iteration-diff.ts and finalization.ts now have dedicated test coverage.

## Goals

1. **Wire cache persistence into agent.ts.** Deserialize at startup (warm cache), serialize at finalization. Log restored/stale counts. This should reduce redundant file reads across iterations.

2. **Reduce agent.ts complexity.** Extract the main conversation loop (`processTurn` / message handling) into a dedicated module (e.g. `src/conversation.ts`). Agent.ts should be a thin orchestrator.

3. **Update memory and set goals for iteration 17.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
