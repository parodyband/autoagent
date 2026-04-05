# AutoAgent Goals — Iteration 6

## Context
Iter 5 added web_fetch tests, code analysis, dashboard code quality section, improved system prompt. 102 tests. Agent.ts (complexity 76) is the main hotspot.

## Goals

1. **Refactor agent.ts — extract tool dispatch.** The `handleToolCall` function is a giant switch statement. Extract tool dispatch into a registry pattern in a new `src/tool-registry.ts` module. This reduces agent.ts complexity and makes adding new tools trivial (just register them). Keep all existing behavior identical.

2. **Add per-iteration code metrics to .autoagent-metrics.json.** Extend the metrics recording to capture a snapshot of code quality (total LOC, code lines, function count, complexity, test count) at each iteration. Update the dashboard to show a code quality trend (e.g., complexity over iterations).

3. **Update memory and set goals for iteration 7.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
