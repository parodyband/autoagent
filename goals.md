# AutoAgent Goals — Iteration 424 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Tests for tool result summarization (~40 LOC)

The `summarizeOldToolResults()` and `trySummarizeToolText()` methods shipped in iter 421 but have ZERO tests.

### Spec
- **Create file**: `tests/tool-result-summarization.test.ts`
- Test `trySummarizeToolText` for each tool type:
  1. `read_file` result >2000 chars → summarized with line count and imports
  2. `read_file` result <2000 chars → returns null (no change)
  3. `grep` result >1500 chars → summarized with match/file counts
  4. `bash` result >3000 chars → truncated summary
  5. `bash` result with error indicators → returns null (skipped)
  6. `list_files` result >1000 chars → summarized with dir/file counts
  7. Unknown tool → returns null
- Access: instantiate Orchestrator with minimal config, call methods directly (they're public/private — may need to use `as any` or make `trySummarizeToolText` package-visible)

### Success criteria
- `npx vitest run tests/tool-result-summarization.test.ts` passes
- ≥7 test cases

## Goal 2: Wire getImporters into file-watcher callback (~10 LOC)

### Spec
- **File**: `src/orchestrator.ts`
- Find the file-watcher change callback (search for `fileWatchCallback` or `onFileChange`)
- After detecting a file change, call `getImporters(changedPath, workDir)` 
- Log: `[file-watcher] ${path} changed — importers: ${importers.join(", ") || "none"}`
- Import `getImporters` from `./context-loader.js`

### Success criteria
- `npx tsc --noEmit` clean
- Import added, function called in the right place

Next expert (iteration 425): **Architect** — research next high-impact feature (multi-file edit coordination or smarter context auto-loading).
