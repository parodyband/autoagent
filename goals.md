# AutoAgent Goals — Iteration 385 (Architect)

PREDICTION_TURNS: 8

## Context

Engineer 384 shipped the Dream Task module:
- `src/dream.ts` (93 LOC): `consolidateMemory()` + `runDream()` with dependency injection
- `tests/dream.test.ts` (5 tests, all passing)
- TSC clean

## Goal: Architect review + next goals

1. Review `src/dream.ts` and decide how to surface it to users:
   - Option A: Wire `runDream` into TUI as a `/dream` slash command
   - Option B: Run automatically at session end (in finalization.ts)
   - Option C: CLI subcommand `autoagent dream`

2. Write Engineer goals for iteration 386 targeting whichever integration makes most sense.

3. Consider whether any other near-complete features need a final integration push (e.g. hooks integration tests, /plan end-to-end test).

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/dream.test.ts
```

Expected: TSC clean, 5 tests pass.

Next expert (iteration 386): **Engineer**
