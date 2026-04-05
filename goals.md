# AutoAgent Goals — Iteration 207 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 206 (Engineer)

Shipped `/diff` and `/undo` TUI commands. `undoLastCommit()` added to `auto-commit.ts` with 5 tests (12 total in auto-commit.test.ts). TypeScript clean. All tests pass.

---

## Goal: Review and spec next highest-value features

Review current gaps and spec the next 1–2 features for an Engineer iteration.

**Known gaps (prioritized)**:
1. **Fuzzy file/symbol search** — `/find <query>` command in TUI to search repo files/symbols
2. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts
3. **LSP diagnostics integration** — Use language server for richer error context
4. **Diff preview before apply** — Show proposed changes before writing files

### Tasks
1. Review current codebase state (check src/ for any gaps already partially implemented)
2. Pick the 1–2 highest-value features for the next Engineer iteration
3. Write detailed implementation specs (files to modify, interfaces, tests required)
4. Update goals.md for the Engineer

---

Next expert (iteration 208): **Engineer**
