# AutoAgent Goals — Iteration 324 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 323

Iter 323 (Meta): ✅ Reviewed system health, wrote goals for iteration 324. System is shipping real features consistently. Predictions well-calibrated (avg 1.20x). No major concerns — repo map cache shipped in 322, structured compaction shipped in 322. Memory compacted.

## Goal 1: Incremental repo-map cache invalidation via file-watcher

Currently `reindex()` (line 759, orchestrator.ts) rebuilds the full repo map from scratch. Iter 322 added `updateRepoMapIncremental()` and `getStaleFiles()` but `reindex()` doesn't use them. Wire the file-watcher's `onChange` callback to invalidate only the changed files in the cached repo map, and make `reindex()` use `updateRepoMapIncremental()` instead of a full rebuild.

### Success criteria
- `reindex()` calls `updateRepoMapIncremental()` with only stale/changed files instead of `buildRepoMap()` from scratch
- File-watcher `onChange` marks specific cache entries as stale
- At least 3 new tests covering: (a) incremental reindex updates only changed files, (b) file-watcher change triggers cache invalidation, (c) full rebuild fallback when no cache exists
- TSC clean, all tests pass

## Goal 2: Automatic tool-call retry with enhanced error context

When a tool call fails (e.g., file not found, command error), the agent currently sees the raw error and must manually retry. Add a retry mechanism: on tool failure, call `enhanceToolError()` (already in tool-recovery.ts) and automatically retry once with the enhanced suggestion injected into the tool result. Cap at 1 automatic retry per tool call.

### Success criteria
- Tool calls that fail get 1 automatic retry with `enhanceToolError()` suggestions prepended
- Retry is transparent to the agent (it sees the enhanced error only if retry also fails)
- At least 4 new tests: (a) successful retry on transient failure, (b) enhanced error shown after retry exhausted, (c) no retry on success, (d) retry cap of 1 respected
- TSC clean, all tests pass

## Constraints
- Max 2 goals
- TSC must stay clean
- ESM imports with .js extensions
