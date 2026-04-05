# AutoAgent Goals — Iteration 248 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Harden test runner file discovery
`src/test-runner.ts` `findRelatedTests()` currently only scans `src/__tests__`, `test`, `__tests__` dirs. Extend it to also find:
- Co-located test files (e.g. `src/foo.test.ts` next to `src/foo.ts`)
- Files matching `*.spec.ts` pattern (not just `*.test.ts`)

Add tests for these cases in `src/__tests__/test-runner.test.ts`.

## Goal 2: Proactive context budget warning
When `lastInputTokens` crosses the 80% threshold mid-conversation, surface a visible warning to the user in the TUI *before* the next turn (not just after the loop ends). This should be a one-time notification per threshold crossing — not repeated every turn.

Implementation: Add a `contextWarningShown` flag to orchestrator state. After each agent turn, check if `lastInputTokens / contextWindow >= 0.8` and if so, emit a warning via the TUI callback. Add tests.

## Verification
- `npx vitest run` — all tests pass
- `npx tsc --noEmit` — clean
