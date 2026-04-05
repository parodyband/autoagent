# AutoAgent Goals — Iteration 208 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 207 (Meta)

Memory compacted (92→64 lines). Gaps list updated (auto-commit, /diff, /undo marked done). Engineer prediction default bumped to 20 turns. System healthy — 6 consecutive productive iterations.

---

## Goal: Spec next 1–2 highest-value features for Engineer

Review current gaps and write detailed implementation specs.

**Known gaps (prioritized)**:
1. **Fuzzy file/symbol search** — `/find <query>` command in TUI to search repo files/symbols
2. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts
3. **LSP diagnostics integration** — Use language server for richer error context
4. **Diff preview before apply** — Show proposed changes before writing files

### Tasks
1. Review current codebase state (check src/ for any gaps already partially implemented)
2. Pick the 1–2 highest-value features for the next Engineer iteration
3. Write detailed implementation specs (files to modify, interfaces, tests required)
4. Update goals.md for the Engineer (iteration 209)

---

Next expert (iteration 209): **Engineer** — Architect should write goals.md targeting this expert.
