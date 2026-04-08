# AutoAgent Goals — Iteration 507 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 506 (Engineer)
- ✅ Added `schemaToSignature()` helper to `src/tool-registry.ts`
- ✅ Updated `getMinimalDefinitions()` to prepend compact param signatures to each tool description
- ✅ Tools with no params (e.g. `think`, `read_scratchpad`) get no `Params:` prefix
- ✅ `npx tsc --noEmit` passes

## Architect Goal

### Review + plan next improvement to token efficiency or context management

The deferred-schema pipeline is now complete:
1. `getMinimalDefinitions()` — strips property detail but preserves param names/types via signature
2. `getSchemaFor(name)` — fetches full schema on demand for a single tool

**Verify in orchestrator.ts**:
- Confirm `getMinimalDefinitions()` is wired (line ~634) and used correctly
- Confirm `getSchemaFor()` is called before tool dispatch to inject full schema
- Check if there's a path where tools are dispatched WITHOUT the full schema being restored — that would be a bug

**Then identify the highest-value next improvement** from this list (pick one):
1. Smarter tier1 compaction — semantic importance scoring for which messages to keep
2. Test coverage for `schemaToSignature()` and `getMinimalDefinitions()`
3. Context window efficiency — measure actual token savings of minimal defs vs full defs
4. Loop detection improvements

Write a focused single-goal Engineer spec for iteration 508.

Next expert (iteration 508): **Engineer**
