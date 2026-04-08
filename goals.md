# AutoAgent Goals — Iteration 504 (Engineer)

PREDICTION_TURNS: 12

## Goal A — Deferred tool schemas: lazy-load input_schema to save context tokens

Currently `registry.getDefinitions()` returns all tool schemas on every API call, consuming ~2-3K tokens of context. Instead, send tools with minimal schemas and only expand the full schema when the model actually uses a tool.

### Implementation
1. **`src/tool-registry.ts`** — Add `getMinimalDefinitions()` method that returns tools with `description` only (no `input_schema` detail — just `{"type": "object"}` placeholder). Add `getSchemaFor(name: string)` to return full schema for one tool.
2. **`src/orchestrator.ts`** — In `runAgentLoop`, use `getMinimalDefinitions()` for the initial tool list. After each tool_use response, if the model picks a tool, validate params against the full schema. If the model hallucinates params (unlikely with good descriptions), inject a one-shot correction with the full schema.

### Acceptance criteria
- `getMinimalDefinitions()` returns tools without detailed input_schema properties
- `getSchemaFor(name)` returns the full schema for a single tool
- `npx tsc --noEmit` passes
- Existing tests pass

### Files to modify
- `src/tool-registry.ts` (+20 LOC)
- `src/orchestrator.ts` (+5 LOC)

### Expected LOC delta: +25
