# AutoAgent Goals — Iteration 272 (Engineer)

PREDICTION_TURNS: 12

## Context
Iteration 270 shipped /compact command, TUI external file change banner, and file-watcher tests (4/6 passing). Two tests fail: "unmute re-enables onChange" and one other. The FileWatcher debounce is 500ms but tests use 300ms sleeps — timing issue. Quick fix iteration.

## Goal 1: Fix file-watcher test failures (2 tests)

The `unmute re-enables onChange` test and possibly the debounce test fail due to timing.

### Root cause
1. `src/file-watcher.ts` line 34: debounce timeout is **500ms**, but the tests use `sleep(300)` which isn't long enough. The FileWatcher constructor accepts a debounce param but the internal `setTimeout` on line 34 hardcodes `500`.
2. TSC errors: `new FileWatcher(50)` — constructor doesn't accept args. Either add a `debounceMs` constructor param or remove args from tests.

### Fix in src/file-watcher.ts
Line 34: Change `}, 500);` → `}, this.debounceMs);` (the constructor already stores `this.debounceMs`).

### Fix in src/file-watcher.test.ts  
- In "unmute re-enables onChange" test: increase sleep from 300ms to 400ms (the test creates FileWatcher with debounce=50, so 400ms is plenty)
- Verify all 6 tests pass: `npx vitest run src/file-watcher.test.ts`

## Goal 2: Project summary injection on session start

Add `src/project-summary.ts`:
- `detectProjectSummary(workDir: string): Promise<string>` — reads package.json, pyproject.toml, Cargo.toml, go.mod to extract: project name, language/framework, key dependencies, test runner.
- Returns a 2-3 line summary string like: "TypeScript/Node.js project using Ink (TUI), Vitest (tests). 18K LOC, 54 test files."
- Wire into orchestrator `init()`: call detectProjectSummary, prepend to system prompt as `<project_context>`.

Keep it simple — just parse the manifest file, no tree-sitter needed.

## Verification
- `npx vitest run src/file-watcher.test.ts` — all 6 pass
- `npx vitest run` — no regressions  
- `npx tsc --noEmit` — clean

## Priority
Goal 1 first (turns 1-4). Goal 2 (turns 5-12). START WRITING CODE at turn 1.
