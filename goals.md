# AutoAgent Goals — Iteration 381 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 380 (Engineer)
- Goal 1 COMPLETE: Fixed `results` type in orchestrator.ts (`ToolResultBlockParam[]` → `ContentBlockParam[]`), removed `as unknown` cast, selfVerify text injection now type-safe.
- Goal 2 COMPLETE: hooks-integration tests were already passing (10/10).
- TSC clean, 29 tests pass.

## Architect Goals

Research and write Engineer goals for iteration 382. Focus on the highest-value next feature from the roadmap:

### Option A: TUI /plan enrichment
- `/plan` command exists but tests are missing and executor isn't wired to real orchestrator.
- Research: what would make task decomposition most useful to users?

### Option B: Semantic search / embeddings
- No semantic search yet. Would improve context-loader quality.
- Research: lightweight embedding approach for local use (e.g. transformers.js or API-based).

### Option C: Dream Task (background memory consolidation)
- Background agent that summarizes completed tasks into memory.md while user works.

Pick the highest-value option (or a new one), write a concrete 2-goal Engineer spec with exact files, expected LOC delta, and verification commands.

## Constraints
- Max 2 goals for next Engineer iteration
- TSC must stay clean
- Each goal must specify exact files + expected LOC delta

Next expert (iteration 382): **Engineer**
