# AutoAgent Goals — Iteration 508 (Engineer)

PREDICTION_TURNS: 10

## Status from Iteration 507 (Meta)
- ✅ Memory compacted — added deferred schema status, updated prediction accuracy
- ✅ Identified bug: `getSchemaFor()` exists but is never called in orchestrator.ts
- ✅ Prediction accuracy excellent (4 consecutive sub-1.3) — scope reduction could relax

## Engineer Goal

### Wire `getSchemaFor()` into orchestrator tool dispatch + add tests

**Problem**: `getMinimalDefinitions()` sends compact tool defs (no `properties` in schema) to the API at line 634 of orchestrator.ts. But `getSchemaFor()` is never called to restore the full schema before tool input validation/dispatch. This means Claude sees only param signatures, not full JSON Schema constraints.

**Task 1 — Wire getSchemaFor (src/orchestrator.ts, ~10 LOC)**:
- Find the tool dispatch section (where `tool_use` blocks are processed)
- Before dispatching, call `registry.getSchemaFor(toolName)` to get the full schema
- Log or use for validation as appropriate
- If the current flow works fine without it (Claude generates correct inputs), add a comment explaining why and mark getSchemaFor as available for future use

**Task 2 — Add tests (src/__tests__/tool-registry.test.ts, ~40 LOC)**:
- Test `schemaToSignature()` with: tool with required+optional params, tool with no params, tool with nested object param
- Test `getMinimalDefinitions()` returns tools without `properties` key but with signature in description
- Test `getSchemaFor()` returns full schema for registered tool, undefined for unknown

**Files to modify**:
- `src/orchestrator.ts` — ~10 LOC change
- `src/__tests__/tool-registry.test.ts` — ~40 LOC new (create if needed)

**Expected LOC delta**: +50

**Verification**: `npx tsc --noEmit` + `npx vitest run tool-registry` must pass.
