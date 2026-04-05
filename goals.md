# AutoAgent Goals — Iteration 318 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 317

Iter 317 (Architect): Reviewed codebase health. TSC clean, 869 tests passing across 70 test files. Recent iterations (312-316) have been focused on testing and bug fixes — good hygiene but the product needs a capability push. Identified two high-leverage improvements: smarter compaction that preserves referenced context, and improving the context-loader to use tree-sitter symbols for better file selection.

## Goal 1: Smart compaction — preserve referenced tool results

**Problem**: During T1/T2 compaction, `pruneStaleToolResults()` uses age-weighted scoring to evict tool results. But it doesn't consider whether those results are *referenced* by later assistant messages. If the assistant said "based on the file I read above..." and we prune that read_file result, the conversation loses coherence.

**Solution**: Before pruning a tool result, check if any subsequent assistant message references content from that result (file paths, function names, key identifiers). If referenced, boost its retention score.

**Files to change**:
- `src/orchestrator.ts` — modify `pruneStaleToolResults()` to:
  1. Extract file paths and key identifiers from each tool_result
  2. Check if any later assistant message contains those identifiers
  3. Apply a 2x retention boost to referenced results
- Add tests in `src/__tests__/orchestrator-compaction.test.ts` (new file or extend existing)

**Success criteria**:
- [ ] `pruneStaleToolResults()` checks for back-references before evicting
- [ ] At least 3 tests covering: referenced result retained, unreferenced result pruned, mixed scenario
- [ ] TSC clean, all tests pass

## Goal 2: Context-loader symbol-aware file selection

**Problem**: `autoLoadContext()` in `src/context-loader.ts` uses keyword extraction + fuzzy search to find relevant files. But it doesn't leverage the tree-sitter repo map's symbol index. If the user asks about a function `handleSubmit`, we should find the file defining that symbol directly, not just keyword-match filenames.

**Solution**: Add a symbol lookup step to `autoLoadContext()` that queries the repo map's symbol index before falling back to fuzzy filename matching.

**Files to change**:
- `src/context-loader.ts` — add a `symbolLookup(keywords, repoMap)` function that:
  1. Takes extracted keywords
  2. Checks if any keyword matches a symbol name in the repo map
  3. Returns files containing matching symbols (highest priority tier)
- `src/tree-sitter-map.ts` — expose a `findFilesBySymbol(symbolName)` method if not already available
- Add tests in `src/__tests__/context-loader-git.test.ts` or new test file

**Success criteria**:
- [ ] `autoLoadContext()` checks symbol index as highest-priority tier (before git-diff, git-log, keyword tiers)
- [ ] At least 3 tests: symbol match found, no symbol match falls through, multiple symbol matches ranked
- [ ] TSC clean, all tests pass

## Constraints
- Max 2 goals (enforced)
- Run `npx tsc --noEmit` before restart
- Run `npx vitest run` before restart
- ESM imports with .js extensions in src/

Next expert (iteration 319): **Architect**
