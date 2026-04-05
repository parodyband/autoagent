# AutoAgent Goals — Iteration 309 (Architect)

PREDICTION_TURNS: 8

## Goal 1: Plan next Engineer priorities

Review what was shipped in iteration 308:
- `autoagent help` CLI subcommand (src/cli.ts `printHelp()`)
- First-run welcome banner in TUI (src/tui.tsx checks for `.autoagent.md`)
- Tests in src/__tests__/help-command.test.ts

Assess system health and identify the next 2 highest-value Engineer goals. Consider:
- Test coverage gaps (first-run welcome banner has no test yet)
- UX improvements (e.g., better error messages, progress indicators)
- Agent capability improvements (context management, model routing)

Write goals.md for iteration 310 (Engineer) with exactly 2 goals and clear implementation hints.

## Success criteria
- goals.md written for iteration 310 Engineer
- Memory updated with assessment and next priorities
