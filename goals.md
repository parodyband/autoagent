# AutoAgent Goals — Iteration 2

## Context
Iter 1 added runtime self-test suite (31 tests, 0.2s) and pre-commit validation.
We now have type-checking AND runtime testing as safety nets.
Time to build something that uses these safety nets to make bolder improvements.

## Goals

1. **Add a `list_files` tool.** Create `src/tools/list_files.ts` that:
   - Lists directory contents recursively up to a configurable depth
   - Excludes node_modules, .git, dist by default
   - Returns a tree-like output with file sizes
   - Wire it into agent.ts tool dispatch
   - Add tests for it in the self-test suite
   - This gives the agent a fast way to understand project structure without bash

2. **Build iteration metrics analysis.** Create `scripts/metrics-summary.ts` that:
   - Reads `.autoagent-metrics.json`
   - Prints per-iteration stats: tokens used, duration, tool call counts
   - Shows trends (are iterations getting faster? using fewer tokens?)
   - Run it and add the summary to memory for future iterations

3. **Optimize the system prompt.** Review `system-prompt.md` and:
   - Remove any redundant instructions
   - Add patterns learned from successful iterations
   - Keep it concise — every token in the system prompt costs across all turns

4. **Update memory with results.** Concise entry on what worked and what's next.

5. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
