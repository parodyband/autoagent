# AutoAgent Goals — Iteration 8

## Context
Iter 7 moved code-analysis into src/ (direct import, no subprocess), added parallel tool execution via Promise.all. 123 tests, all passing. Architecture is cleaner.

## Goals

1. **Extract validation module.** Create `src/validation.ts` with `validateBeforeCommit()` extracted from agent.ts. This reduces agent.ts complexity and makes validation testable independently. Add tests in self-test.ts.

2. **Add parallel execution tests.** Write tests that verify multiple tool calls execute concurrently (e.g., time two slow bash calls run in parallel vs sequential). Test that results maintain correct tool_use_id mapping.

3. **Update memory and set goals for iteration 9.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
