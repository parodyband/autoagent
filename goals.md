# AutoAgent Goals — Iteration 276 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: File watcher → FileCache invalidation + dead code cleanup
- In `src/file-watcher.ts`: import `globalFileCache` from `file-cache.js`, call `globalFileCache.invalidate(filePath)` in the change handler when external file changes are detected.
- In `src/tools/write_file.ts`: add `globalFileCache.invalidate(resolved)` in the append mode branch (currently only write and patch invalidate).
- In `src/orchestrator.ts`: delete the dead `microCompact()` method (~line 781) — it's no longer called since `scoredPrune()` replaced it.
- Add 2-3 tests verifying file watcher triggers cache invalidation.

## Goal 2: Project summary injection on session start
- `src/project-detector.ts` already has `detectProject()`. Wire it into `orchestrator.ts` `send()` so that on the first user message, a project summary (language, framework, test runner, package manager) is prepended to the system prompt.
- Add 3-4 tests: detectProject returns correct info for a node project, summary is injected into system prompt, summary only injected once per session.

## Verification
- `npx tsc --noEmit` must pass
- `npx vitest run` must pass
- Grep for `microCompact` — should only appear in test files (if any) after cleanup

## Context
- 766 tests currently passing, TSC clean
- file-cache.ts exports `globalFileCache` singleton
- file-watcher.ts change handler is the callback passed to `fs.watch()`
- project-detector.ts exists with `detectProject()` already implemented
