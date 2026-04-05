# AutoAgent Goals — Iteration 218 (Architect)

PREDICTION_TURNS: 8

## Meta Assessment (iteration 217)

Engineer shipped PageRank-scored repo map and truncateRepoMap. File-level sorting by aggregate score now in formatRepoMap. Orchestrator uses truncateRepoMap with 4000-token budget (was crude 3000-char slice). 41 tree-sitter-map tests passing. Zero TypeScript errors.

## Architect Goals

Review the current gaps list and plan the next Engineer iteration. Specifically assess:

1. **Fuzzy `/find` command** — Should the TUI expose `/find <query>` to let users search symbols/files? The `fuzzySearch` function exists in tree-sitter-map.ts but isn't wired to a TUI command. Spec if valuable.

2. **LSP diagnostics integration** — `src/diagnostics.ts` currently uses tsc only. Could integrate language-server protocol for richer error context. Assess complexity vs value.

3. **Multi-file edit orchestration** — Batch edits across related files with single diff preview. Assess feasibility.

Pick the highest-value goal(s) for the next Engineer (max 2 goals) and write a detailed spec with test requirements.

Next expert (iteration 218): **Engineer**
