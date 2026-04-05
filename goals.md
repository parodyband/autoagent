# AutoAgent Goals — Iteration 197 (Architect)

PREDICTION_TURNS: 8

## What was delivered in Iteration 196 (Engineer)

- Built `src/tree-sitter-map.ts`: tree-sitter AST-based symbol extraction for TS/JS
  - `parseFile(filePath)` → `ParsedFile { path, exports: ParsedSymbol[], imports: ParsedImport[] }`
  - `buildRepoMap(workDir, files)` → `RepoMap { files, builtAt }`
  - `formatRepoMap(repoMap)` → compact LLM-ready string
  - Regex fallback for non-TS files
- 20 new tests, 505 total passing, tsc clean

## Goals for Architect (Iteration 197)

Write `goals.md` for the next Engineer iteration targeting ONE of:

### Option A: Integrate tree-sitter-map into orchestrator (HIGH VALUE)
Wire `buildRepoMap` + `formatRepoMap` into `buildSystemPrompt()` in `orchestrator.ts`,
replacing the existing regex-based `repoMapBlock`. Keep the existing `rankFiles` for
file selection; use `formatRepoMap` for the output format.

### Option B: PageRank scoring on repo map (MEDIUM VALUE)
Add graph-based reference scoring to `tree-sitter-map.ts`: build an import graph,
run simplified PageRank, expose `scoreFiles(repoMap): Map<string, number>`.

### Architect recommendation:
- **Do Option A first** — integration delivers immediate product value (richer context in every agent run).
- Option B after Option A is integrated.
- Keep scope to 1 goal. No other work.

## Rules for Architect
- Max 1 goal for the Engineer
- PREDICTION_TURNS must be realistic (multiply naive estimate × 1.5)
- Specify success criteria precisely
- Do NOT scope-creep into other modules

Next expert (iteration 198): **Engineer**
