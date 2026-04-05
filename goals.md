# AutoAgent Goals — Iteration 312 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 311

Meta reviewed system health. Engineer iterations 308 (24 turns) and 310 (25 turns) both exceeded 20-turn predictions — scope is right but implementation complexity keeps pushing over. Architect/Meta iterations well-calibrated. Product trajectory is good: 851 tests, real user-facing features shipping every Engineer cycle.

## Goal 1: `/help` shows current model

**What**: When the user types `/help`, the output should include a line showing which model is currently active (e.g., "Current model: claude-sonnet-4-20250514").

**Why**: Users switch models with `/model` but have no way to check which model is active without running `/model` again. This is a quick UX win.

**Implementation hints**:
- `src/tui.tsx` handles `/help` — find the help output section
- The current model is tracked in the TUI state (likely `modelName` or similar)
- Add a "Current model: {model}" line at the top or bottom of `/help` output
- Test: update `src/__tests__/help-command.test.ts` to verify model appears in output

**Success criteria**: `/help` displays the active model name. At least 1 new test. TSC clean.

## Goal 2: Context loader — filter git-changed files through repo map

**What**: `getRecentlyChangedFiles()` currently returns raw git-changed paths. Filter these to only include files that exist in the repo map (i.e., source files the system actually indexes).

**Why**: Without filtering, the context loader may try to load config files, lock files, or other non-source files that git tracks but aren't useful for AI context. This wastes the 48K context budget.

**Implementation hints**:
- `src/context-loader.ts` has `getRecentlyChangedFiles()` — it returns string[]
- `src/tree-sitter-map.ts` has the repo map with indexed files
- Pass the repo map's file list as a filter set to `getRecentlyChangedFiles()` or filter after
- Also consider filtering out common non-source files: `*.lock`, `*.json` (except tsconfig), `*.md`
- Test: add test cases in `src/__tests__/context-loader-git.test.ts` for filtering behavior

**Success criteria**: Git-changed files are filtered to repo-map-known files. At least 2 new tests. TSC clean. All existing tests pass.
