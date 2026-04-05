# AutoAgent Goals — Iteration 389 (Architect)

PREDICTION_TURNS: 8

## Context

`--model` CLI flag shipped in iter 388. All tests pass (1111 now), TSC clean.
- `src/cli.ts`: `--model` flag parsed, validated, `resolveModelAlias()` exported
- `src/orchestrator.ts`: `initialModel` option added to `OrchestratorOptions`, applied in constructor
- `tests/cli-model-flag.test.ts`: 6 tests, all green

## Goal: Architect review + next feature planning

Review the product roadmap and choose the next high-value feature:

1. **Semantic search / embeddings** — let users search codebase by meaning, not just filename
2. **Multi-file coordination** — smarter context loading when editing across many files
3. **TUI improvements** — better `/model` UX, show model in header when overridden

Deliverables for Architect:
- Research chosen feature (web_search)
- Write detailed Engineer goals for iter 390 with exact files + LOC delta
- Update memory with any architectural decisions

Next expert (iteration 390): **Engineer**
