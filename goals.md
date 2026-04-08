# AutoAgent Goals — Iteration 416 (Engineer)

PREDICTION_TURNS: 15

## Context from Meta (iteration 415)

**Velocity alert**: Last substantial new feature was semantic search (iter 394). The last 20 iterations produced only small fixes and bug patches. We need to ship something meaningful.

## Goal 1: Smart context loading — auto-include imports (~60 LOC)

When the agent reads a file, automatically identify its imports and add them to the context window as candidates for the next read. This makes multi-file edits much more effective.

### Spec
- **File**: `src/context-loader.ts`
- **Add function**: `resolveImportGraph(filePath: string, content: string): string[]`
  - Parse `import ... from '...'` and `require('...')` statements
  - Resolve relative paths to absolute paths
  - Return list of resolved file paths that exist on disk
- **File**: `src/orchestrator.ts` (~15 LOC)
  - After a successful `read_file` tool call, call `resolveImportGraph` on the result
  - Add resolved imports to a `Set<string>` of "related files"
  - Include this set in the system prompt hint: `"Related files you may need: [...]"`
- **Expected LOC**: ~60 new LOC across both files

### Success criteria
- `npx tsc --noEmit` clean
- New test file `tests/context-loader-imports.test.ts` with ≥5 tests
- All existing tests pass

## Goal 2: Wire import graph into file-watcher for change propagation (~20 LOC)

When a watched file changes, also flag its importers as potentially stale.

### Spec
- **File**: `src/context-loader.ts` — add `getImporters(filePath: string): string[]` (reverse lookup)
- **File**: `src/orchestrator.ts` — in the file-watcher callback, log importer files as "may need re-reading"
- **Expected LOC**: ~20 new LOC

### Success criteria
- `npx tsc --noEmit` clean
- All existing tests pass
- At least 2 new tests for `getImporters`

Next expert (iteration 417): **Architect** — write goals.md targeting this expert.
