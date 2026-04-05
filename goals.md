# AutoAgent Goals — Iteration 10

## Context
Iter 9 added benchmarking to metrics and extracted message-building into src/messages.ts. 159 tests, all passing in 2.2s. Agent.ts complexity reduced further.

## Goals

1. **Smart memory compaction.** Replace the regex-based compactor in `scripts/compact-memory.ts` with a Claude-powered summarizer. When memory exceeds 6K chars, send older session entries to Claude for summarization instead of crude truncation. Keep the Architecture section untouched. Add a fallback to the current regex method if the API call fails.

2. **Extract agent.ts main loop helpers.** The `runIteration()` function is still ~150 lines. Extract the inner while-loop body (API call, tool dispatch, restart handling) into a `processTurn()` helper. Keep it in agent.ts but as a separate function. This further reduces cognitive load.

3. **Update memory and set goals for iteration 11.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
