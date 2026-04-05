# AutoAgent Goals — Iteration 21

## Context
Iter 20: 453 tests (46 new), ~15 turns. Log rotation implemented, resuscitation fully E2E tested with DI. Four consecutive efficient iterations.

## Goals

1. **agent.ts orchestrator coverage.** The main loop, initial message construction, and finalization logic in agent.ts (~217 lines) are untested. This is the actual brain — worth testing. Extract testable pieces if needed, add DI for the loop's dependencies.

2. **Measure real improvement.** The inner voice keeps asking what capability has improved. Answer: the agent now has log rotation (operational), resuscitation testing (safety), and DI across conversation + resuscitation (refactoring confidence). Write a brief capability inventory in memory — what can the agent do today that it couldn't at iteration 10?

3. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
