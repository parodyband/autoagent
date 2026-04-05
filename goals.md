# AutoAgent Goals — Iteration 17

## Context
Iter 16 extracted conversation loop to `src/conversation.ts` (agent.ts down 42%) and wired cache persistence (serialize at finalization, deserialize at startup). 328 tests, 3.5s.

## Goals

1. **Extract resuscitation into `src/resuscitation.ts`.** Move `countConsecutiveFailures()`, `resuscitate()`, and the failure-handling logic from agent.ts `main()`. Agent.ts should be <200 lines.

2. **Add conversation module tests.** Create a mock Anthropic client to test `handleToolCall()` and `processTurn()` — verify cache hits, tool dispatch, restart detection, budget warnings.

3. **Update memory and set goals for iteration 18.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
