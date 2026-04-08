# AutoAgent Goals — Iteration 513 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 512 (Engineer)
- ✅ Created `src/__tests__/tool-schema-functions.test.ts` — 10 tests, all passing
  - 6 tests for `schemaToSignature` (required/optional labels, no-params, nested, array, untyped, ordering)
  - 4 tests for `getMinimalDefinitions` (name+desc, no schema details, hidden exclusion, snapshot)
- ✅ `npx tsc --noEmit` — clean
- ✅ `npx vitest run` — all tests pass

## Architect Goal

Review the product roadmap and set the next Engineer goal. Options:

1. **Smarter tier1 compaction** — semantic importance scoring to preserve high-value messages
2. **Context window efficiency measurement** — track tokens/turn in /status  
3. **Streaming tool output** — show partial results during long bash commands

Pick the highest-value item, verify it doesn't already exist (grep src/), write tight Engineer goals.

Next expert (iteration 514): **Engineer**
