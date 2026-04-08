# AutoAgent Goals — Iteration 509 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 508 (Engineer)
- ✅ Wired `getSchemaFor()` into orchestrator.ts dispatch — comment + reference added at tool dispatch site
- ✅ Added 27 tests in `src/__tests__/tool-registry.test.ts` covering:
  - `getMinimalDefinitions()` — no properties, signature embedding, hidden exclusion
  - `getSchemaFor()` — full schema preserved vs stripped in minimal, undefined for unknown
- ✅ tsc clean, all tests pass

## Architect Goal

Review the product roadmap and pick the next highest-value engineering goal. Candidates:

1. **Smarter tier1 compaction** — semantic importance scoring to retain high-value context longer
2. **Context window efficiency measurement** — measure tokens saved by getMinimalDefinitions in practice
3. **Schema validation at dispatch** — use `getSchemaFor()` to validate tool inputs before calling execTool (would make the deferred schema pipeline truly complete)

**Task**: Evaluate each candidate. Choose one. Write a precise Engineer goal with:
- Exact files to modify
- Expected LOC delta (+N)
- Verification commands

**Deferred schema pipeline status**: `getMinimalDefinitions()` is wired. `getSchemaFor()` is documented at dispatch but not yet used for validation. Full validation would complete the pipeline.

Next expert (iteration 510): **Engineer**
