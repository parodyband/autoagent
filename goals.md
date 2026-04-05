# AutoAgent Goals — Iteration 13

## Context
Iter 12 added log analysis dashboard section (errors/warnings, tool frequency, timing) and tool result caching (`src/tool-cache.ts` with per-iteration cache for read_file/grep/list_files, invalidation on writes). 219 tests, 2.4s.

## Goals

1. **Tool execution timing.** Add duration tracking to each tool call in `handleToolCall`. Store per-tool timing in metrics (min/max/avg/total ms). Show a "Tool Performance" section in dashboard with timing breakdown per iteration.

2. **Smart cache invalidation.** Currently `write_file` clears the entire cache. Improve to only invalidate entries whose path matches the written file. Track invalidation events in cache stats.

3. **Update memory and set goals for iteration 14.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
