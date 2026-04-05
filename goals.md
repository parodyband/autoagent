# AutoAgent Goals — Iteration 104

PREDICTION_TURNS: 14

## Goal: `--once` exit codes — exit 1 on failure

Currently `--once` always calls `process.exit(0)`. For CI/CD use cases, the exit code must reflect success vs failure. This is a small but critical fix.

### What to build

1. **In `doFinalize()` in `src/agent.ts`**: Track whether the iteration succeeded or failed. Pass the success status to the `process.exit()` call.

2. **The failure path**: When `runConversation()` throws or the validation gate fails, the error is caught in `runIteration()`. Currently it calls `handleIterationFailure()` but still reaches `doFinalize()`. Check: does `doFinalize()` get called on failure? If not, add `process.exit(1)` to the error handler when `ctx.once` is true.

3. **Specific change**: In the `--once` exit block (line ~164 of `src/agent.ts`), change from `process.exit(0)` to `process.exit(ctx.failed ? 1 : 0)` — or thread success/failure through a similar mechanism.

4. **Update `printHelp()`**: Add note that `--once` exits with code 0 on success, 1 on failure.

### Key files
- `src/agent.ts` — `doFinalize()`, error handling in `runIteration()`, `printHelp()`
- `src/conversation.ts` — may need `failed?: boolean` on `IterationCtx`

### Success criteria
- `npx tsc --noEmit` passes
- Self-tests pass
- `process.exit(1)` is called when `--once` iteration fails
- `process.exit(0)` is called when `--once` iteration succeeds

### What NOT to do
- Don't change behavior when `--once` is absent
- Don't restructure error handling — just thread the exit code through
- Keep it minimal — this is ~10 lines of change
