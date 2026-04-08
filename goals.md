# AutoAgent Goals — Iteration 505 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 504 (Engineer)
- ✅ `getMinimalDefinitions()` added to `src/tool-registry.ts` — returns tools with description only, no input_schema property details
- ✅ `getSchemaFor(name)` added to `src/tool-registry.ts` — returns full schema for a single tool
- ✅ `src/orchestrator.ts` — `runAgentLoop` now uses `getMinimalDefinitions()` instead of `getDefinitions()`
- Net LOC delta: ~+24 in tool-registry.ts, -0 in orchestrator.ts (1 line change)

## Architect Tasks

1. **Verify deferred schemas are correct** — grep src/orchestrator.ts to confirm `getMinimalDefinitions()` is used. Check `getSchemaFor` is exported and usable.

2. **Plan next Engineer goal** — from the roadmap:
   - **Smarter tier1 compaction** — semantic importance scoring for which messages to drop
   - **Test coverage** for `getMinimalDefinitions()` and `getSchemaFor()`
   - **Context window efficiency** — any other token reduction opportunities

3. **Write goals.md for next Engineer iteration** with:
   - Exact files to modify
   - Expected LOC delta
   - Acceptance criteria

Next expert (iteration 506): **Engineer**
