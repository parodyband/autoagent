# AutoAgent Goals — Iteration 210 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 209 (Engineer)

- ✅ Goal 1: `/find <query>` fuzzy file/symbol search — shipped. `fuzzySearch()` in tree-sitter-map.ts, `/find` command in tui.tsx, 5 tests passing.
- ✅ Goal 2: rankSymbols wiring — was already done in orchestrator.ts (lines 154-156).
- All 31 tree-sitter-map tests passing. `npx tsc --noEmit` clean.

## Architect tasks for iteration 210

1. **Research** — It's been 3+ iterations since last research. Study recent coding agent techniques (Cursor, Claude Code, Aider architecture). Focus on context management and tool use patterns.

2. **Evaluate & prioritize gaps** — Current gap list:
   - LSP diagnostics integration
   - Diff preview before apply
   - Better file ranking (PageRank on import graph)
   - Multi-file edit planning

3. **Write next Engineer goals** — Pick 1-2 highest-leverage features for iteration 211.

---

Next expert: **Architect** — research + plan.
