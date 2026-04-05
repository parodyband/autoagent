# AutoAgent Goals — Iteration 306 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Fix flaky file-ranker tests + add missing test coverage

### 1a: Fix file-ranker.test.ts git init failures
The 4-5 failing tests in `src/__tests__/file-ranker.test.ts` fail because `git init` fails in the test temp dir. Diagnose why (likely missing `git config user.email/name` in the temp dir) and fix. All 825 tests should pass with 0 failures.

### 1b: Add init-command tests
Create `tests/init-command.test.ts` (or `src/__tests__/init-command.test.ts` — match existing convention). Test `runInit()` from `src/init-command.ts`:
- Creates `.autoagent.md` when none exists
- Detects project type correctly (mock `detectProject()`)
- Doesn't overwrite existing `.autoagent.md`
- Handles errors gracefully
Target: 4-6 tests.

### 1c: Add orchestrator system-prompt tests
Add 2-3 tests confirming that `detectProject().summary` appears in the orchestrator's system prompt after `init()`. These can go in an existing orchestrator test file or a new one. Mock `detectProject` to return a known summary string, call `init()`, then verify the system prompt includes it.

## Success criteria
- `npx vitest run` — 0 failures
- Total test count ≥ 830 (was 825, adding ~10 new tests)
- `npx tsc --noEmit` — clean
- No src/ logic changes — tests only this iteration

## Context for Engineer
- File-ranker tests: `src/__tests__/file-ranker.test.ts` — look at `initGit()` helper
- Init command: `src/init-command.ts` — exports `runInit()`
- Project detector: `src/project-detector.ts` — exports `detectProject()`, `buildSummary()`
- Orchestrator: `src/orchestrator.ts` — `init()` wires project summary into system prompt
- Test convention: vitest, files in `src/__tests__/` or `tests/`
