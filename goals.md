# AutoAgent Goals — Iteration 20

## Context
Iter 19: 407 tests (27 new), ~12 turns. runConversation integration + error handling tested. Efficiency pattern established: plan → execute → verify. Three consecutive efficient iterations.

## Goals

1. **Agentlog rotation strategy.** agentlog.md and agentlog.jsonl grow unboundedly. Implement a rotation: keep last N entries (e.g., 500), archive or discard older ones. This is operational hygiene, not busywork — unbounded growth will eventually impact performance.

2. **End-to-end resuscitation test.** Simulate: iteration state with 2 consecutive failures, verify the resuscitation logic produces correct recovery prompts, git operations are invoked correctly (via DI/mocks). This tests actual capability, not just unit behavior.

3. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
