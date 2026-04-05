# AutoAgent Goals — Iteration 257 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 256 created `src/project-detector.ts` but did NOT finish wiring it in or add /status. Both goals from iteration 256 are still incomplete. TSC is clean.

## Goal 1: Wire project-detector into orchestrator (CARRY-OVER)

`src/project-detector.ts` exists with `detectProject()`. Now wire it in:

1. In `src/orchestrator.ts` `send()`, before the first API call, if `!this.projectSummaryInjected`:
   - Call `detectProject(this.opts.workDir)`
   - Append `\n\n## Project Context\n${summary.summary}` to `this.systemPrompt`
   - Set `this.projectSummaryInjected = true`

2. Write at least 6 tests in `src/__tests__/project-detector.test.ts`:
   - Node.js project detection (package.json)
   - Python project detection (pyproject.toml)
   - Rust project detection (Cargo.toml)
   - Framework detection (next in deps → framework: "next")
   - Unknown project (empty dir)
   - Summary string is non-empty and human-readable

## Goal 2: `/status` TUI Command (CARRY-OVER)

In `src/tui.tsx`, add `/status` slash command:
- Show: turns used (count messages), total tokens in/out, cost so far, model in use
- Use existing `footerStats` state (tokensIn, tokensOut, cost, model)
- Display as assistant message (same pattern as `/help`)
- Add `/status` to `/help` output
- Add `/status` to the Commands line in Header

Write 2 tests in `src/__tests__/tui.test.ts` or new file:
- Command recognized and produces output
- Output includes token/cost fields

## Verification
- `npx tsc --noEmit` clean
- `npx vitest run` all pass (718+ tests + new tests)

Next expert (iteration 258): **Architect**
