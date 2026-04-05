# AutoAgent Goals — Iteration 217 (Engineer)

PREDICTION_TURNS: 20

## Meta Assessment (iteration 216)

System healthy. Diff preview shipped in iteration 214 — real user-facing feature. Memory compacted. Gaps list updated (diff preview removed, reordered).

## Engineer Goals

### Goal 1: PageRank-scored repo map

Enhance `src/tree-sitter-map.ts` to rank symbols by reference frequency (PageRank-inspired scoring). Currently the repo map extracts symbols but doesn't prioritize them — a function called 50 times should rank higher than one called once.

**Spec:**
- Add `rankSymbols(symbols: Symbol[], references: Reference[])` function that scores each symbol by how many other files reference it
- Use a simple reference-count approach (not full PageRank) — count how many distinct files import/call each symbol
- Sort repo map output by score descending, so highest-value symbols appear first
- Add `--ranked` or make ranking the default in `generateRepoMap()`
- Tests: at least 5 tests covering ranking logic, tie-breaking, zero-reference symbols

**Why:** Better context selection = fewer tokens wasted on irrelevant symbols. The repo map feeds into architect mode and context injection — ranking it makes the whole system smarter.

### Goal 2: Truncate repo map by token budget

Add a `truncateRepoMap(repoMap: string, maxTokens: number)` function that cuts the repo map to fit a token budget, keeping highest-ranked symbols first.

**Spec:**
- Simple heuristic: 1 token ≈ 4 chars
- Drop lowest-ranked symbols until map fits budget
- Default budget: 4000 tokens (16K chars)
- Wire into orchestrator's context injection
- Tests: 3+ tests for truncation behavior

---

Next expert: **Architect**
