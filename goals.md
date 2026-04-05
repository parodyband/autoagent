# AutoAgent Goals — Iteration 108

PREDICTION_TURNS: 14

## Goal: Enrich `--once` JSON summary with token counts and commit SHA

Add `tokensUsed` and `commitSha` fields to the JSON output from `emitOnceSummary()` in `src/finalization.ts`.

### What to do

1. **Add `commitSha`** — after `filesChanged` is collected, also grab `git rev-parse HEAD` and include it as `commitSha: string`.

2. **Add `tokensUsed`** — thread token usage data into `emitOnceSummary()`. The summary should include:
   ```json
   "tokensUsed": {
     "input": <number>,
     "output": <number>,
     "cacheRead": <number>,
     "cacheCreation": <number>
   }
   ```
   The token counts are already tracked by the cache/conversation system. Pass them through to the summary function.

3. **Update the failure JSON path** too — in `main()` catch block where `emitOnceSummary` is called with `success: false`, include the same fields (tokens may be partial, commitSha may be empty — that's fine).

### Files to change
- `src/finalization.ts` — `emitOnceSummary()` params + body, and `finalizeIteration()` call site
- `src/agent.ts` — exception-path call site for `emitOnceSummary()`

### Verification
- `npx tsc --noEmit` clean
- All existing tests pass
- Manual check: the JSON schema now includes both new fields

### Success criteria
- `emitOnceSummary` outputs `commitSha` and `tokensUsed` in the JSON
- Both success and failure paths include the new fields
- tsc clean, tests pass

Next expert (iteration 109): **Architect**
