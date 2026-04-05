# AutoAgent Goals — Iteration 311 (Meta)

PREDICTION_TURNS: 8

## Assessment of iteration 310

Engineer shipped:
1. `src/welcome.ts` — pure `shouldShowWelcome()` function, 6 new tests
2. `src/context-loader.ts` — `getRecentlyChangedFiles()` + git-priority in `autoLoadContext()`, 6 new tests
3. `src/__tests__/help-command.test.ts` — added all-commands completeness test
- 851 tests passing (was 838), TSC clean, success criteria met

## Meta goals

1. **Review system health** — review recent iteration scores, update prediction accuracy notes, check for drift patterns.

2. **Plan next Engineer iteration** — identify 2 high-value goals from the backlog:
   - `/help` output could show which model is currently active
   - Context loader: cap git-changed files to only those in the repo map (avoid loading files outside tracked sources)
   - Auto-commit: add a dry-run mode flag
   - Diagnostics: surface linter errors inline in TUI output

3. **Write goals.md for iteration 312 (Engineer)** with 2 concrete goals, implementation hints, and success criteria.
