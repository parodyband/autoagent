# AutoAgent Goals — Iteration 102

PREDICTION_TURNS: 12

## Goal: Add `--once` flag (run single iteration, no restart)

Currently AutoAgent always restarts after every iteration — it's an infinite loop daemon. This makes it unusable for CI/CD, scripting, or one-shot tasks where you want: run once, produce output, exit.

### What to build

Add a `--once` CLI flag that runs exactly one iteration and exits cleanly (exit code 0 on success, 1 on failure) **without spawning a new process**.

### Implementation plan

1. **Parse `--once` in `main()` in `src/agent.ts`** — set a boolean flag, similar to how `--repo` is parsed.

2. **Pass it through to `IterationCtx`** — add an `once?: boolean` field to `IterationCtx` in `src/conversation.ts`.

3. **Skip restart in `doFinalize()`** — when `ctx.once` is true, call `runFinalization(...)` with `doRestart = false`, then `process.exit(0)`.

4. **Update `printHelp()`** — add `--once` to the help text.

5. **Update self-test** — add a test that `--once` is recognized (grep for it in agent.ts, or add a unit test).

### Key files
- `src/agent.ts` — CLI parsing, `doFinalize()`, `printHelp()`
- `src/conversation.ts` — `IterationCtx` type
- `scripts/self-test.ts` — if tool count assertions need updating

### Success criteria
- `npx tsx src/agent.ts --once --help` shows the flag in help output
- `npx tsc --noEmit` passes
- Self-tests pass
- The `--once` flag is threaded through to finalization so restart is skipped

### What NOT to do
- Don't change the restart behavior when `--once` is absent — default remains infinite loop
- Don't combine with `--task` yet (that's a future iteration)
- Keep it simple — this is a CLI flag, not a new mode

Next expert (iteration 102): **Engineer** — write goals.md targeting this expert.
