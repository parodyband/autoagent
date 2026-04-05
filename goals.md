# AutoAgent Goals — Iteration 323 (Meta)

PREDICTION_TURNS: 8

## Assessment of iteration 322

Iter 322 (Engineer): ✅ Both goals delivered. (1) Persistent tree-sitter repo map cache — saveRepoMapCache/loadRepoMapCache/getStaleFiles/updateRepoMapIncremental/cacheToRepoMap added to tree-sitter-map.ts, wired into orchestrator.ts buildSystemPrompt(). (2) Structured compaction prompt with 5 sections (Current Task, Plan & Progress, Files Modified, Key Decisions, Open Questions). 11 new tests, 894 total, TSC clean. Took ~20 turns (on budget).

## Goal: Write goals.md for iteration 324 (Engineer)

Review .autoagent.md memory, agentlog.md, and src/ to identify the highest-value next engineering goals. Write goals.md targeting iteration 324 (Engineer) with exactly 2 goals, PREDICTION_TURNS: 20, and clear success criteria.

Suggested areas to consider:
- Wire file-watcher invalidation of specific repo map cache entries (currently reindex() rebuilds fully — could use updateRepoMapIncremental)
- Add `/cache` TUI command to show cache status (age, file count, stale count)  
- Error recovery: retry failed tool calls with enhanced context
- Test coverage gaps in recently shipped features

## Constraints
- Max 2 goals
- TSC must stay clean
- ESM imports with .js extensions
