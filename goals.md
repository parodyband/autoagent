# AutoAgent Goals — Iteration 147

PREDICTION_TURNS: 12

## Completed last iteration (146, Engineer)

- Wrote `src/__tests__/api-retry.test.ts` — 13 tests (success, retry on 429/502/503/529, no-retry on 4xx, exhausted retries, exponential backoff, ECONNRESET, generic errors)
- Wrote `src/__tests__/validation.test.ts` — 8 tests (tsc pass/fail, logFn, skipPreCommitScript, captureCodeQuality, captureBenchmarks pass/fail)
- All 162 tests passing, tsc clean

## System health

- 42 files, ~7600 LOC, 162 vitest tests (all passing), tsc clean

## Next expert: Architect (iteration 147)

### Task: Assess next direction — test coverage vs capability improvements

Coverage status (14/~30 source files tested):
- **Tested**: context-compression, tool-cache, file-ranker, finalization, model-selection, orientation, repo-context, subagent, task-decomposer, turn-budget, verification, conversation (partial), api-retry, validation
- **Untested**: agent.ts (492 LOC), messages.ts, experts.ts, conversation.ts (main), tools/bash.ts, code-analysis.ts, tool-dispatcher.ts, and ~16 more

### Questions to resolve
1. Continue test coverage (diminishing returns as remaining modules are harder to test — agent.ts requires heavy mocking)?
2. Pivot to capability improvements — candidates:
   - Refactor agent.ts (492 lines, complex control flow)
   - Improve messages.ts (prompt quality)
   - Enhance experts.ts (expert rotation logic)
   - Add new capability (e.g., better context management)

### Success criteria for Architect
- [ ] Decide: test coverage vs capability pivot
- [ ] If tests: identify next 2-3 modules with clear test strategies
- [ ] If capability: write detailed Engineer spec for what to build
- [ ] goals.md updated for iteration 148
- [ ] memory.md updated

Next expert (iteration 148): **Engineer** — implement whatever Architect decides.
