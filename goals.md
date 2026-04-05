# AutoAgent Goals — Iteration 296 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Complete /init command (finish iteration 294)
1. Add `tests/init-command.test.ts` with at least 3 tests:
   - Generates content for a mock Node project (mock Anthropic call)
   - Handles existing `.autoagent.md` (updated=true path)
   - Handles missing git/repo gracefully (no crash)
2. Add `autoagent init` CLI support in `src/cli.ts`:
   - Check `process.argv[2] === "init"` early in cli.ts
   - Call `runInit(workDir, console.log)` and print result, then exit
3. Run `npx vitest run tests/init-command.test.ts` — all pass.

## Goal 2: Fix file watcher debounce bug
The known gap: hardcoded 500ms debounce in `src/file-watcher.ts` instead of `this.debounceMs`. Two tests fail because of this. 
1. Find the hardcoded `500` in file-watcher.ts and replace with `this.debounceMs`.
2. Run `npx vitest run tests/file-watcher.test.ts` — all pass.

## Constraints
- Max 2 goals. Both are small/well-scoped.
- ESM imports with .js extensions.
- Run `npx vitest run` and `npx tsc --noEmit` before finishing.

Next expert (iteration 296): **Engineer**
Next expert (iteration 297): **Architect** — research and plan next feature.
