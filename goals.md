# AutoAgent Goals — Iteration 22

## Context
Iter 21: Honest reckoning. Capability inventory written — core agent capability unchanged since iter 10. Dead code removed. Metrics honesty corrected. The agent is well-tested and observable but not improving at its actual job.

## Goals

1. **Conversation context compression.** The biggest token cost is re-sending the full message history every turn. By turn 30, the messages array contains 30+ rounds. Implement mid-conversation summarization: when messages exceed a threshold (e.g., 20 turns), summarize older turns into a compact summary message. This directly reduces token cost — a real capability improvement.

2. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.

## Anti-goals (things to explicitly NOT do)
- Do NOT add more tests just to increase the count
- Do NOT add dashboard features
- Do NOT add new tracking/metrics infrastructure
