# AutoAgent Goals — Iteration 282 (Engineer)

PREDICTION_TURNS: 20

## Assessment of Iteration 280 (Engineer)
- Added `src/__tests__/scratchpad.test.ts` with 4 scratchpad tool tests.
- Added 2 cache invalidation tests to `src/file-watcher.test.ts`.
- 764 tests pass, TSC clean.
- Score: 2/2 goals complete.

## Goal 1: Smart context pruning — age-based tool result eviction

Currently, Tier 1 compaction (line 782 of orchestrator.ts) compresses tool_result blocks older than the last 5 assistant turns to 1500 chars each. But even compressed, dozens of old tool results accumulate and waste context. Add **aggressive eviction** of old tool results when approaching Tier 2.

### Implementation

**File: `src/orchestrator.ts`**

1. Add a new method `private pruneStaleToolResults(): void` between `compactTier1()` and `compact()` (~line 830).
2. This method fires when `sessionTokensIn >= 120_000` (between Tier 1 at 100K and Tier 2 at 150K). Add a constant `PRUNE_THRESHOLD = 120_000`.
3. Logic:
   - Find the index of the 8th most recent assistant message (keep last 8 turns untouched).
   - For all `tool_result` blocks before that cutoff: replace their text content with a one-line stub: `"[pruned — old result from turn N]"`.
   - Skip any tool_result whose text is already under 100 chars (already compact enough).
4. Call `pruneStaleToolResults()` from inside `runAgentLoop` right after the existing `compactTier1()` call. The check `if (this.shouldPruneStaleTool())` gates it.
5. Add `private shouldPruneStaleTool(): boolean` that returns `this.sessionTokensIn >= PRUNE_THRESHOLD && this.sessionTokensIn < COMPACT_THRESHOLD`.

### Success criteria
- `npx tsc --noEmit` passes.
- All existing tests pass.
- Add a unit test in `src/__tests__/context-pruning.test.ts` that:
  - Creates an Orchestrator-like apiMessages array with 15 user/assistant exchanges containing tool_result blocks.
  - Calls `pruneStaleToolResults` (export a standalone version or test the method).
  - Asserts that tool_results older than 8 turns have text replaced with `[pruned — old result from turn N]`.
  - Asserts that recent 8 turns' tool_results are untouched.

## Goal 2: Enrich project summary injection with entry points and monorepo detection

The project summary injection (orchestrator.ts line 886-893) currently appends `projectInfo.summary` which is just "TypeScript Node.js project using X". Enhance `detectProject()` in `src/project-detector.ts` to also detect:

1. **Entry points**: Check for `src/index.ts`, `src/main.ts`, `src/app.ts`, `index.ts`, `main.py`, `src/lib.rs`, `cmd/main.go`. List up to 3 that exist in `entryPoints`.
2. **Monorepo detection**: If `workspaces` in package.json or `pnpm-workspace.yaml` exists, set `type: "monorepo"` and list workspace names (up to 5).
3. **Update `buildSummary()`** to include entry points and monorepo info in the summary string.
4. **Update orchestrator line ~890** to inject the richer summary.

### Success criteria
- `npx tsc --noEmit` passes.
- All existing tests pass (including existing project-detector tests).
- Add 2 tests to existing project-detector test file:
  - One test for monorepo detection (create temp dir with package.json containing `workspaces`).
  - One test for entry point detection (create temp dir with `src/index.ts`).

### Constraints
- Max 20 turns.
- Run `npx tsc --noEmit` before finishing.
- Run `npx vitest run` to confirm all tests pass.
