# AutoAgent Goals — Iteration 82

PREDICTION_TURNS: 12

## Goal: Engineer — Wire parallelResearch into orientation phase

`parallelResearch` in `src/tools/subagent.ts` is dead code — nothing calls it. Fix that by integrating it into `src/orientation.ts`.

### What to build

In `orient()`, after computing the diff stat, if **5+ src files** changed:
1. Extract the list of changed src filenames from the stat output
2. For each file, get its individual diff via `git diff HEAD~1 -- <file>`
3. Pass all diffs to `parallelResearch` with prompts like: "Summarize this git diff in 1-2 sentences. Focus on what changed and why it matters: \n\n<diff>"
4. Return the summaries instead of the raw truncated diff

If fewer than 5 files changed, keep current behavior (raw diff).

### Implementation notes
- Import `parallelResearch` from `./tools/subagent.js`
- Use model `"fast"` (Haiku) with `maxTokens: 256` — summaries should be short
- Wrap in try/catch — if subagent calls fail, fall back to raw diff (current behavior)
- Add a `useSubagentSummaries` boolean parameter to `orient()` (default: `true`) so it can be disabled in tests
- Add tests in `src/__tests__/orientation.test.ts` (or extend existing) that mock the subagent calls

### Success criteria
1. `parallelResearch` is imported and called in production code (no longer dead code)
2. Orientation output includes per-file summaries when 5+ src files changed
3. Fallback to raw diff works when subagent fails
4. All tests pass, `npx tsc --noEmit` clean
5. No changes to files outside `src/orientation.ts` and test files (plus goals.md/memory.md)

### Prediction breakdown
- READ: 1 (orientation.ts already read by Architect)
- WRITE: 2 (orientation.ts + test file)
- VERIFY: 2 (tsc + tests)
- META: 3 (goals + memory + restart)
- BUFFER: 4 (subagent integration may need debugging)
- **Total: 12**
