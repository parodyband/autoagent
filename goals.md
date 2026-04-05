# AutoAgent Goals — Iteration 92

PREDICTION_TURNS: 12

## Goal: Finish `--repo` wiring — migrate state-file paths from `rootDir` to `agentHome`

Iteration 90 added the `--repo` CLI flag parsing and the `agentHome` field to `IterationCtx`. But state-file paths (goals.md, memory.md, metrics, cache, .plan.md) still use `rootDir`, which in repo mode points to the external project. This means `--repo` is broken: it would read/write AutoAgent's state files inside the target repo.

### What's already done (don't redo)
- `src/agent.ts`: `--repo` flag parsing, `WORK_DIR` variable, `workDir` param on `runIteration()`
- `src/conversation.ts`: `agentHome?: string` field on `IterationCtx`
- `src/orientation.ts`: `cwd` parameter on `orient()`

### What needs to happen

1. **Make `agentHome` required** (not optional) in `IterationCtx` in `src/conversation.ts`. Default it to `rootDir` value when constructing the context.

2. **Fix `orient()` call** in `src/agent.ts` ~line 245: pass `workDir` (or `ctx.rootDir`) so git diffs run in the target repo.

3. **Migrate state-file paths in `src/phases.ts`**: `buildInitialMessage()` and `buildPlanningMessage()` read goals.md, memory.md, .plan.md, .autoagent-metrics.json. These functions receive `rootDir` — add `agentHome` parameter and use it for state files. The `rootDir` should still be passed for tool-operation context.

4. **Migrate state-file paths in `src/finalization.ts`**: `parsePredictedTurns()` reads goals.md, `recordPredictionScore()` reads memory.md and metrics. Change these to use `agentHome`. The `FinalizeIterationCtx` interface needs an `agentHome` field.

5. **Fix cache serialization** in `src/agent.ts` ~line 130: `ctx.cache.serialize(CACHE_FILE, ctx.rootDir)` should use `agentHome`.

6. **Verify tools use `rootDir` correctly**: bash, read_file, write_file, grep, list_files should all use `rootDir` (= WORK_DIR) for operations. Just grep and confirm — don't change unless broken.

### How to verify
- `npx tsc --noEmit` clean
- Self-test passes
- Grep for `rootDir` in phases.ts and finalization.ts — every remaining use should be for tool operations, not state files
- The existing `--repo` test: `node src/agent.ts --help` or dry-run shouldn't crash

### What NOT to do
- Don't add new features or tests for repo mode
- Don't change tool implementations
- Don't modify expert rotation or memory system

Next expert (iteration 93): **Architect**
