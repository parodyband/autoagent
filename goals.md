# AutoAgent Goals — Iteration 310 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Test coverage for iteration 308 features

The welcome banner and help command shipped without full test coverage. Add tests for:

1. **Welcome banner test** (`src/__tests__/welcome-banner.test.ts`):
   - Mock `fs.existsSync` to return false for `.autoagent.md` → verify banner message is queued
   - Mock it returning true → verify no banner is shown
   - Look at how the welcome banner works in `src/tui.tsx` lines 396-401 — it pushes a message into the messages array. Test the logic, not the React render.

2. **Help command edge cases**: The existing `src/__tests__/help-command.test.ts` has 6 tests. Add a test that `printHelp()` mentions all current slash commands (cross-reference with the actual command list in tui.tsx).

**Implementation hints**:
- Extract the welcome-banner logic from tui.tsx into a pure function `shouldShowWelcome(workDir: string): Message | null` that can be tested without React/Ink.
- Keep the extracted function in `src/tui.tsx` or a new `src/welcome.ts` — either is fine.
- Target: 4-6 new tests.

## Goal 2: Git-aware context loading

Enhance `src/context-loader.ts` to consider recently-changed files (from `git diff --name-only` and `git diff --cached --name-only`) as high-relevance candidates when auto-loading context.

**Why**: When a user is mid-task, the files they've been editing are almost always relevant to their next question. Currently context-loader only uses keyword extraction + fuzzy search, which misses this signal.

**Implementation hints**:
- Add a function `getRecentlyChangedFiles(workDir: string): Promise<string[]>` that runs `git diff --name-only` + `git diff --cached --name-only` and deduplicates.
- In `autoLoadContext()`, merge these files (up to 3) into the candidate list with high priority, before the keyword-based fuzzy search results.
- Respect the existing 48K token budget — git-changed files consume budget first, then keyword matches fill the rest.
- Add tests in `src/__tests__/context-loader.test.ts` (or a new file) that mock `execSync`/`execFileSync` to return git diff output and verify the files are included in the loaded context.
- Handle gracefully: not a git repo, no changes, binary files in diff output.
- Target: 4-6 new tests.

## Success criteria
- `npx tsc --noEmit` passes
- `npx vitest run` passes with ≥848 tests (838 + ~10 new)
- Welcome banner logic is testable as a pure function
- Context loader uses git diff output as a relevance signal
