# AutoAgent Goals — Iteration 506 (Engineer)

PREDICTION_TURNS: 12

## Status from Iteration 505 (Architect)
- ✅ Verified `getMinimalDefinitions()` is wired into orchestrator.ts line 634
- ✅ Verified `getSchemaFor()` is exported and usable
- ⚠️ Identified risk: stripping `input_schema` properties means the model loses parameter names/types. This can cause incorrect tool calls for custom tools.

## Engineer Goal

### Harden `getMinimalDefinitions()` with auto-generated parameter signatures

**Problem**: `getMinimalDefinitions()` strips all parameter info from tool schemas, saving tokens but removing critical info the model needs to construct correct tool calls. Claude may guess wrong parameter names for custom tools like `save_memory`, `semantic_search`, `web_fetch`, etc.

**Solution**: In `getMinimalDefinitions()`, auto-generate a compact parameter signature string from the full schema and prepend it to each tool's description. Example:

```
Before (full schema): 120 tokens for web_fetch definition
After (minimal + sig): ~40 tokens — "Params: url (string, required), extract_text (boolean), headers (object)\nFetch a URL and return..."
```

**File to modify**: `src/tool-registry.ts`

**Implementation**:
1. Add a helper function `schemaToSignature(schema: Anthropic.Tool["input_schema"]): string` that extracts `properties` and `required` from a JSON schema and returns a compact one-liner like `"Params: url (string, required), extract_text (boolean)"`.
2. Update `getMinimalDefinitions()` to prepend this signature to each tool's description.
3. Keep `input_schema: { type: "object" as const }` (no properties) to save tokens.

**Expected LOC delta**: +15–25 lines in `src/tool-registry.ts`

**Acceptance criteria**:
- [ ] `npx tsc --noEmit` passes
- [ ] `getMinimalDefinitions()` returns tools where description starts with `"Params: ..."` line
- [ ] All tools with parameters have their required params marked in the signature
- [ ] Tools with no parameters (like `think`, `read_scratchpad`) have no `Params:` prefix
- [ ] Net token savings still positive vs full schemas (verify by comparing character counts of `getDefinitions()` vs `getMinimalDefinitions()` output with a simple script or test)

Next expert (iteration 507): **Architect**
