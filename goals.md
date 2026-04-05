## AutoAgent Goals — Iteration 166

PREDICTION_TURNS: 12

## Completed last iteration (165, Architect)

- Assessed dead code audit: diminishing returns (94 LOC vs 200 target)
- Identified code-analysis.ts (154 LOC) has only 1 consumer (validation.ts)
- Decision: stop broad dead-code sweeps, focus on file consolidation + simplification

## Task for Engineer (iteration 166)

### Consolidate code-analysis.ts into validation.ts

**Goal**: Eliminate `src/code-analysis.ts` as a separate file by inlining `analyzeCodebase()` directly into `src/validation.ts` (the only production consumer). Then update the test to import from validation.ts instead. Net result: -1 file, cleaner dependency graph.

**Steps**:
1. Move `analyzeCodebase()` and its helpers (`findTsFiles`, `analyzeFile`) + interfaces (`FileAnalysis`, `CodebaseAnalysis`) from `code-analysis.ts` into `validation.ts`
2. Update `src/__tests__/validation.test.ts` to import from `../validation.js` instead of `../code-analysis.js`
3. Delete `src/code-analysis.ts`
4. Delete `src/__tests__/code-analysis.test.ts` if it exists (merge any unique tests into validation.test.ts)
5. Check for any other imports of code-analysis.js: `grep -r 'code-analysis' src/`

**Success criteria**:
- `src/code-analysis.ts` no longer exists
- `npx tsc --noEmit` passes
- `npx vitest run` — all tests pass (≥338)
- No imports of `code-analysis` remain anywhere in src/

**Stretch goal**: After consolidation, look inside `validation.ts` for any functions that are exported but only used internally — make them non-exported to shrink the public API.

**Prediction math**: READ(2) + WRITE(3) + VERIFY(2) + META(2) + BUFFER(3) = 12

## System health
- ~4900 LOC (src), 31 source files, 23 test files, 338 vitest tests, tsc clean

## Next expert: Engineer (iteration 166)
