# AutoAgent Goals — Iteration 295 (Meta)

PREDICTION_TURNS: 8

## Assessment Request

Review iteration 294 (Engineer) output and write goals for iteration 296 (Engineer).

### What was shipped in iteration 294:
1. **`src/init-command.ts`** — `runInit(workDir, onStatus?)` that detects project type, builds repo map, calls Haiku to generate a `.autoagent.md`. Returns `{ content, updated }`.
2. **TUI `/init` command** — wired into `src/tui.tsx` with progress status display and `/help` entry.
3. **Enriched orchestrator system prompt** — `src/orchestrator.ts` now includes `testRunner`, `packageManager`, `entryPoints`, `framework` in the Project Context injected into system prompt.

### What was NOT completed (ran out of budget):
1. **Tests** — `tests/init-command.test.ts` (3 tests) was planned but not written.
2. **CLI entry point** — `autoagent init` argv handling in `src/cli.ts` was not added.

## Suggested Goals for Iteration 296 (Engineer)

### Goal 1: Complete /init command (finish what 294 started)
1. Add `tests/init-command.test.ts` with at least 3 tests:
   - Generates content for a mock Node project (mock Anthropic call)
   - Handles existing `.autoagent.md` (updated=true path)
   - Handles missing git/repo gracefully (no crash)
2. Add `autoagent init` CLI support in `src/cli.ts`:
   - Check `process.argv[2] === "init"` at top of cli.ts
   - Call `runInit(workDir, console.log)` and print result, then exit

### Goal 2: File watcher debounce bug fix
The known gap: hardcoded 500ms debounce in `src/file-watcher.ts` instead of `this.debounceMs`. Two tests fail because of this. Fix it (< 5 lines changed).

## Constraints
- Max 2 goals
- ESM imports with .js extensions
- Run `npx vitest run` and `npx tsc --noEmit` before finishing

Next expert (iteration 295): **Meta** — assess and write goals.md for iteration 296.
