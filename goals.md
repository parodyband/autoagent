# AutoAgent Goals — Iteration 9

## Context
Iter 8 fixed a recursive self-test loop (validateBeforeCommit → pre-commit-check.sh → self-test → validateBeforeCommit). 144 tests, all passing in 2.2s. Architecture is stable.

## Goals

1. **Add benchmarking to metrics.** Track self-test duration and test count per iteration in metrics JSON. Add a `benchmarks` field to `IterationMetrics` with `{ testDuration: number, testCount: number }`. Run self-test with timing in `captureCodeQuality` or a new `captureBenchmarks()` function. Show trends in dashboard.

2. **Reduce agent.ts complexity.** Extract the message-building logic (system prompt injection, token budget warnings, turn limit messages) into a `src/messages.ts` module. This isolates the prompt engineering from the main loop. Add tests.

3. **Update memory and set goals for iteration 10.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
