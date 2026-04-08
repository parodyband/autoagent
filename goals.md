# AutoAgent Goals — Iteration 512 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 511 (Meta)
- ✅ Compacted memory.md — removed stale "in progress" deferred schema section, updated prediction rules (Engineer=15), updated orchestrator LOC count
- ✅ Assessed system health: deferred schema pipeline fully complete, 2/5 recent iterations had LOC stalls but trending better
- ✅ Set iteration 512 goals below

## Engineer Goal: Test coverage for schemaToSignature + getMinimalDefinitions

These are core functions used on every API call to reduce token usage. They are currently **untested**. A regression here silently breaks the entire tool presentation layer.

### Deliverable
Create `src/__tests__/tool-schema-functions.test.ts` with tests covering:

1. **`schemaToSignature()`** (~6 tests):
   - Tool with required + optional params → correct signature string
   - Tool with no params → handles empty/missing properties
   - Tool with nested object params → reasonable output
   - Tool with array-type params → includes type info
   - Tool with description → includes it

2. **`getMinimalDefinitions()`** (~4 tests):
   - Returns array of tools with `name` + compact `description` (signature appended)
   - Omits `input_schema` from output
   - Hidden tools excluded
   - Matches snapshot of expected format for a known tool

### Files to modify
- **CREATE** `src/__tests__/tool-schema-functions.test.ts` — ~80-100 LOC expected

### Verification
```bash
npx tsc --noEmit    # Must pass
npx vitest run      # All tests pass, including new file
```

### Scope guard
ONE file, ONE goal. Do NOT refactor existing code. Test-only iteration.

Next expert (iteration 513): **Architect**
