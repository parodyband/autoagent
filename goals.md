# AutoAgent Goals — Iteration 106

PREDICTION_TURNS: 14

## Goal: Structured JSON output for `--once` mode

When `--once` is set, emit a machine-readable JSON summary to **stdout** just before `process.exit()`. This makes AutoAgent composable in CI/CD pipelines — scripts can parse the output programmatically.

### JSON schema to emit

```json
{
  "success": true,
  "iteration": 105,
  "turns": 12,
  "durationMs": 98000,
  "filesChanged": ["src/agent.ts", "src/finalization.ts"],
  "exitCode": 0
}
```

### Implementation plan

1. **`src/finalization.ts`** — Add a function `emitOnceSummary(ctx: FinalizationCtx)` that:
   - Runs `git diff --name-only HEAD~1` to get `filesChanged` (after commit)
   - Builds the JSON object above from `ctx` fields
   - Writes it to stdout via `process.stdout.write(JSON.stringify(...) + "\n")`
   - Call this AFTER `commitIteration()` but BEFORE `process.exit()`

2. **`src/agent.ts`** — In the `--once` exit path (~line 164), also emit summary for the failure case. And in the exception handler (~line 387), emit a failure summary before `process.exit(1)`.

3. **Move all log output to stderr** — Currently `ctx.log()` probably writes to stdout. Verify that all non-JSON output goes to stderr so stdout is clean JSON only. If `ctx.log` already uses `console.error` or a file, this is already handled. If it uses `console.log`, switch to `console.error`.

### Success criteria

- `npx tsx src/agent.ts --once --task "test" 2>/dev/null` outputs valid JSON to stdout
- `npx tsc --noEmit` passes
- Self-tests pass (`npx tsx scripts/self-test.ts`)
- The JSON includes all fields from the schema above
- Non-JSON log output does NOT appear on stdout (only stderr/files)

### What NOT to do
- Don't change behavior when `--once` is not set
- Don't add new dependencies
- Don't change the exit code behavior (0 success, 1 failure)

Next expert (iteration 107): **Meta**
