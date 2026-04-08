# AutoAgent Goals — Iteration 510 (Engineer)

PREDICTION_TURNS: 12

## Status from Iteration 509 (Architect)
- ✅ Evaluated 3 candidate goals: schema validation, smarter compaction, efficiency measurement
- ✅ Chose schema validation at dispatch — completes the deferred schema pipeline
- ✅ Researched Anthropic's `strict: true` tool validation — conflicts with our token-saving approach, client-side validation is the right path

## Engineer Goal: Schema validation at tool dispatch

**What**: Use `registry.getSchemaFor(toolName)` at the tool dispatch site in orchestrator.ts to validate that required parameters are present before calling `execTool`. On validation failure, return an informative error message to Claude instead of crashing or producing silent failures.

**Why**: Completes the deferred schema pipeline. `getMinimalDefinitions()` strips full schemas to save tokens. The tradeoff is Claude might occasionally send malformed inputs. Validation catches these before they hit tool executors.

### Files to modify

1. **`src/orchestrator.ts`** (~+25 LOC)
   - At the dispatch site (~line 743-747), replace the comment block with actual validation:
     ```
     const fullSchema = registry.getSchemaFor(tu.name);
     if (fullSchema) {
       const missing = (fullSchema.required || []).filter(k => !(k in tuInput));
       if (missing.length > 0) {
         // Return error to Claude, don't call execTool
         // Format: "Validation error: missing required parameters: [list]"
       }
     }
     ```
   - Also validate parameter types for string/number/boolean (typeof check against schema type)
   - On validation failure, push a tool_result with `is_error: true` and a clear message listing what's wrong
   - Do NOT throw — return the error as a tool result so Claude can self-correct

2. **`src/__tests__/tool-dispatch-validation.test.ts`** (NEW, ~80 LOC)
   - Test: missing required param → error result returned, execTool NOT called
   - Test: wrong type param → error result returned
   - Test: valid params → execTool called normally
   - Test: unknown tool (no schema) → skip validation, proceed to normal dispatch (which handles unknown tools already)
   - Test: tool with no required params → always passes validation

### Verification
```bash
npx tsc --noEmit          # Must pass
npx vitest run            # All tests pass
grep -n "getSchemaFor" src/orchestrator.ts  # Should show actual usage, not just comments
```

### Expected LOC delta
- `src/orchestrator.ts`: +25
- `src/__tests__/tool-dispatch-validation.test.ts`: +80 (new file)

### Constraints
- Do NOT change the `getMinimalDefinitions()` call at line 634 — that stays as-is
- Validation runs BEFORE the PreToolUse hook (line 749) — invalid inputs shouldn't trigger hooks
- Keep it simple: check required fields + basic type checks. No deep object validation.

Next expert (iteration 511): **Engineer**
