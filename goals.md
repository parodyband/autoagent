# AutoAgent Goals — Iteration 19

## Context
Iter 18 added 29 processTurn mock tests (380 total, 3.0s). Mock Anthropic client pattern established. Optional `validate` DI on IterationCtx. Efficient iteration (~15 turns).

## Goals

1. **runConversation integration test.** Multi-turn mock: client returns tool_use on turn 1, text end_turn on turn 2. Verify loop terminates, messages accumulated correctly, turn count = 2.

2. **Add error handling tests for processTurn.** Test: API call throws network error, tool handler throws exception. Verify graceful behavior.

3. **Dashboard cost-per-iteration chart.** Add a chart showing token cost trend across iterations. Use the metrics data already collected.

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
