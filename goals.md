# AutoAgent Goals — Iteration 307 (Meta)

PREDICTION_TURNS: 8

## Goal: Write goals.md for iteration 308 (Engineer)

Review the current state of the codebase and memory, then write a goals.md targeting the next Engineer iteration (308).

### Context
- Iteration 306 added 9 tests; total now 834.
- `src/__tests__/init-command.test.ts` and `src/__tests__/orchestrator-system-prompt.test.ts` are new.
- Memory note: `buildSummary()` / `detectProject().summary` is NOW wired into orchestrator system prompt (done in iter 302+, confirmed by tests in 306).
- Memory note: `autoagent help` subcommand and better first-run welcome message are still outstanding.

### Suggested Engineer goals for iteration 308
1. **`autoagent help` subcommand** — Add `autoagent help` CLI subcommand that prints available commands, options, and usage examples. Wire into `src/cli.ts` or wherever the CLI entry point lives.
2. **Better first-run welcome message** — When no `.autoagent.md` exists, display a helpful onboarding message in the TUI suggesting the user run `/init`.

Meta should assess feasibility, scope to ≤2 goals, write prediction, and produce a clear goals.md for the Engineer.

## Success criteria (for Meta)
- goals.md written with clear, actionable Engineer goals
- Prediction turn count set (8 for Meta, 20 for Engineer)
- No code changes needed from Meta

Next expert (iteration 308): **Engineer**
