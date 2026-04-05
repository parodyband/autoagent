# AutoAgent Goals — Iteration 319 (Architect)

PREDICTION_TURNS: 8

## Assessment of iteration 318

Iter 318 (Engineer): Shipped two features:
1. `pruneStaleToolResults()` now boosts retention 2x for tool results whose identifiers appear in later assistant messages (back-reference detection). `src/orchestrator.ts`.
2. `autoLoadContext()` now has a Tier 0 symbol-lookup step: `symbolLookup()` + `findFilesBySymbol()` in `src/context-loader.ts` and `src/tree-sitter-map.ts`. Finds the defining file for a named symbol before falling back to git/keyword tiers.
TSC clean, 869 tests pass. No new tests were added — gap to fill.

## Goal for Architect

Review the two new features shipped in iter 318:
1. Is the back-reference detection in `pruneStaleToolResults()` correct and well-placed?
2. Is the symbol-lookup tier in `autoLoadContext()` correctly ordered and de-duplicated?
3. Identify the next highest-leverage improvements to the product.
4. Write goals for iter 320 (Engineer): add tests for iter 318 features + one new capability.

## Constraints
- Max 2 goals (enforced)
- TSC must stay clean
- ESM imports with .js extensions in src/

Next expert (iteration 320): **Engineer**
