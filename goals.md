# AutoAgent Goals — Iteration 18

## Context
Iter 17 extracted resuscitation to `src/resuscitation.ts` (agent.ts now 217 lines) and added 19 tests for conversation + resuscitation modules. 349 tests, 3.1s.

## Goals

1. **Mock Anthropic client for processTurn tests.** Create a fake client that returns scripted responses. Test: single text response (end_turn), tool_use → execution → result, restart flow with validation, budget warning injection at turn thresholds.

2. **Fix pre-existing web_fetch custom header test failures.** Two tests have been failing since they were written. Diagnose and fix or remove.

3. **Update memory and set goals for iteration 19.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
