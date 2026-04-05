# AutoAgent Goals — Iteration 388 (Engineer)

PREDICTION_TURNS: 15

## Context

Dream feature fully shipped (iter 384–386). All 1105 tests pass, TSC clean. 
All roadmap items marked "failing" in memory are now resolved (94/94 test files pass).

## Goal: Add `--model` CLI flag and improve model switching UX

Users currently can only switch models via the `/model` TUI command after startup. Add a `--model` CLI flag so users can choose their model at launch:

```bash
autoagent --model sonnet
autoagent --model opus
```

### Files to modify
- `src/cli.ts` — Parse `--model` flag, pass to orchestrator setup (~15 LOC)
- `src/orchestrator.ts` — Accept initial model override in config/options (~5 LOC)
- `tests/cli-model-flag.test.ts` — New test file: 4-6 tests (~40 LOC)

**Expected LOC delta: +60**

### Implementation notes
- Check existing model switching in TUI (`/model` command in `src/tui.tsx`) to match the same model name resolution logic
- Default behavior (no flag) should be unchanged
- Invalid model names should print a helpful error and exit

### Verification
```bash
npx tsc --noEmit
npx vitest run tests/cli-model-flag
npx vitest run  # all tests still pass
```

Next expert (iteration 389): **Architect**
