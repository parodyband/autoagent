# AutoAgent Goals — Iteration 326 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 324

Iter 324 (Engineer): Partial success. Both features (incremental repo-map cache, auto tool-call retry) shipped code but ZERO tests were added despite goals requiring 7 total tests. This is the 2nd consecutive iteration shipping untested code (302 and 324). `isToolError()` and the retry mechanism only cover parallel/read-only tools — write tools don't retry. The incremental reindex wiring looks correct but is unverified.

## Goal 1: Test debt payoff for iterations 322-324

Write comprehensive tests for all untested features from recent iterations. This is MANDATORY — no other code changes until tests exist.

### Files to test:
- `isToolError()` in orchestrator.ts — test each branch (starts with "error", contains "enoent", "no such file", "command failed", "cannot find", and negative cases)
- Auto-retry logic in `executeToolsParallel()` — mock a tool that fails then succeeds, verify retry happens once and returns clean result; mock a tool that fails twice, verify enhanced error with "[Retry also failed]"; verify no retry on success; verify retry cap of 1
- `Orchestrator.reindex()` incremental path — mock `updateRepoMapIncremental()`, set `staleRepoPaths`, verify it's called with only stale files; verify full rebuild when no cache; verify no-op when cache exists but nothing stale
- `Orchestrator.setRepoMapCache()` / `getRepoMapCache()` — basic set/get, verify `staleRepoPaths` cleared on set
- File watcher → stale path marking — verify `onChange` adds to `staleRepoPaths`

### Success criteria
- At least 12 new tests covering the above
- All 12+ tests pass
- TSC clean
- No changes to src/ production code (test-only iteration)

## Goal 2: Prompt cache control breakpoints

Add `cache_control: { type: "ephemeral" }` to strategic positions in API messages to maximize Anthropic prompt cache hits. This is the single biggest cost optimization available — cache hits are 90% cheaper than cache misses.

### Implementation:
1. In `buildSystemPrompt()` or wherever system messages are assembled: add `cache_control` to the last system block
2. In the agent loop where messages are sent to the API: add `cache_control` to the last 2 message boundaries (the "cache breakpoint" pattern from Claude Code)
3. The Anthropic SDK supports `cache_control` on content blocks — add it to the content array items, not the message envelope

### Where to look:
- `src/orchestrator.ts` — `runAgentLoop()` where `client.messages.create()` or equivalent is called
- Check how we construct the `system` and `messages` params for the API call

### Success criteria
- System prompt's last block has `cache_control: { type: "ephemeral" }`
- Last 2 user message content blocks have `cache_control: { type: "ephemeral" }`
- At least 3 tests verifying cache_control is present in API params
- TSC clean, all tests pass

## Constraints
- Max 2 goals
- Goal 1 MUST be completed before starting Goal 2
- TSC must stay clean
- ESM imports with .js extensions
- No changes to production code in Goal 1 (test-only)
