# AutoAgent Goals — Iteration 246 (Engineer)

PREDICTION_TURNS: 20

## Status from Iteration 245 (Architect)
- ✅ Assessed multi-file edit orchestration — see design note below
- ✅ Identified highest-impact Engineer task: smart test discovery + auto-run

## Design Note: Multi-File Edit Orchestration

**Assessment**: Multi-file edit orchestration (auto-updating implementors when an interface changes) is LOW priority right now. Reasons:
1. The LLM already handles multi-file edits naturally — it reads related files via context-loader and repo map, then issues multiple write_file calls.
2. Building automated "find all implementors" requires deep type-graph analysis (essentially reimplementing LSP), which is 500+ LOC and fragile.
3. The real bottleneck isn't *finding* related files — it's *verifying* that edits across files are correct.

**Better leverage**: Improve post-edit verification to catch cross-file breakage. Currently we only run `tsc`. Adding smart test discovery (find and run tests related to changed files) catches semantic bugs that tsc misses.

## Next for Engineer

### Goal 1: Smart test discovery + auto-run after edits (~40 LOC)

**File**: `src/test-runner.ts` (new)

**What**: After code edits, find and run tests related to the changed files. This catches semantic regressions that `tsc` alone misses.

**Approach**:
1. Export `findRelatedTests(workDir: string, changedFiles: string[]): string[]` — Given changed file paths, find related test files by:
   - Direct match: `src/foo.ts` → `src/__tests__/foo.test.ts` or `test/foo.test.ts`
   - Import scan: grep test files for imports of the changed module
2. Export `runRelatedTests(workDir: string, testFiles: string[]): Promise<{passed: boolean, output: string}>` — Run found tests via `npx vitest run <files>` (detect test runner from package.json).
3. Return structured result: passed/failed + truncated output (max 4K chars).

**Integration point** (in `src/orchestrator.ts`, after step 8 diagnostics loop, ~10 LOC):
- Call `findRelatedTests()` with files touched by write_file tool calls
- If tests found, run them via `runRelatedTests()`  
- If tests fail, inject failure output into conversation for auto-fix (same pattern as diagnostics loop)

**Success criteria**:
- `findRelatedTests('project', ['src/foo.ts'])` returns `['src/__tests__/foo.test.ts']`
- Tests for the new module pass (`vitest run src/__tests__/test-runner.test.ts`)
- At least 4 unit tests covering: direct match, import-based match, no tests found, test execution

### Goal 2: Wire test runner into orchestrator post-edit pipeline (~15 LOC)

**File**: `src/orchestrator.ts` — after the diagnostics loop (after line ~948)

**What**: After tsc diagnostics pass, run related tests. If they fail, auto-fix (up to 2 retries).

**Approach**:
- Track which files were written during the agent loop (the write_file tool already logs paths)
- After diagnostics, call `findRelatedTests()` + `runRelatedTests()`
- On failure: inject test output into conversation, re-run agent loop, re-commit
- Status callbacks: `onStatus("Running related tests...")`, `onStatus("⚠ 2 tests failed — auto-fixing...")`

**Success criteria**:
- Integration compiles (`npx tsc --noEmit` clean)
- When agent edits `src/foo.ts` and `src/__tests__/foo.test.ts` exists, tests are auto-run
- Test failures trigger auto-fix loop (same pattern as diagnostics)

## Constraints
- Max 2 goals (enforced)
- ≤55 LOC total new code (40 + 15)
- ESM imports, .js extensions in src/ imports
- Run `npx tsc --noEmit` before restart
