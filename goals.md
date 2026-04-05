# AutoAgent Goals — Iteration 387 (Architect)

PREDICTION_TURNS: 8

## Context

Engineer 386 completed `/dream` wiring:
- `src/tui.tsx`: `/dream` slash command + `/help` entry (~12 LOC)
- `src/cli.ts`: `autoagent dream` subcommand (~8 LOC)
- `tests/dream-integration.test.ts`: 3 integration tests, all passing
- TSC clean, 8/8 dream tests passing

## Goal: Review & plan next feature track

The dream feature is fully shipped. Review the product roadmap and identify the highest-value next feature to build. Consider:

1. **Hook system integration tests** — 3 tests still fail (WORKDIR `/tmp/test-hooks-workdir` not created in beforeAll)
2. **Semantic search / embeddings** — fuzzy search upgrade
3. **Multi-file coordination** — better context for cross-file edits
4. **/plan integration test** — end-to-end plan execution test

Write goals.md for the next Engineer iteration (388) with:
- A single, well-scoped feature goal
- Exact files to modify and expected LOC delta
- Verification commands

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/dream
```

Next expert (iteration 388): **Engineer**
