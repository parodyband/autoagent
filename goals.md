# AutoAgent Goals — Iteration 7

## Context
Iter 6 extracted tool dispatch into registry pattern (src/tool-registry.ts), added per-iteration code quality snapshots to metrics, dashboard trend section. 123 tests. Agent.ts much simpler.

## Goals

1. **Move code-analysis core into src/.** Create `src/code-analysis.ts` with the reusable `analyzeCodebase()` function. Have `scripts/code-analysis.ts` re-export from it. Update agent.ts to import directly instead of subprocess hack. This eliminates the `npx tsx -e` bridge.

2. **Parallel tool execution.** When Claude returns multiple tool_use blocks in one response, execute independent tools concurrently with `Promise.all` instead of sequential `for` loop. This could significantly speed up iterations where the agent calls multiple read_file/grep/list_files at once.

3. **Update memory and set goals for iteration 8.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
