# AutoAgent Goals — Iteration 254 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 252 shipped: test runner hardening (findTestFile, collectTestFiles with monorepo/colocated support) + multi-linter diagnostics (detectDiagnosticTools with tsc/eslint/pyright/ruff, priority ordering). 687+ tests pass, TSC clean, ~17.5K LOC.

Research finding: Augment Code reports 2x+ speedup from parallel tool execution. Our orchestrator runs tool_use blocks sequentially (line 375-404 in orchestrator.ts). Claude's API already returns multiple tool_use blocks in a single response — we should execute independent ones concurrently.

## Goal 1: Parallel Tool Execution

Currently in `src/orchestrator.ts` around line 366-404, when the model returns multiple tool_use blocks, non-write tools are executed sequentially in a for-loop. Read-only tools (read_file, grep, glob, web_search, web_fetch, list_files) are safe to run in parallel.

### Implementation spec

1. In the agent loop where `nonWriteTools` are processed (around line 375), categorize tools:
   - **Parallelizable (read-only)**: `read_file`, `grep`, `glob`, `web_search`, `web_fetch`, `list_files`, `bash` (only if the command is read-only — skip for now, treat bash as sequential)
   - **Sequential (side-effects)**: `write_file`, `bash`, `save_memory`, `subagent`

2. Create a helper function `executeToolsParallel()` in orchestrator.ts:
   ```typescript
   async function executeToolsParallel(
     tools: Anthropic.ToolUseBlock[],
     executeTool: (tu: Anthropic.ToolUseBlock) => Promise<string>,
   ): Promise<Array<{ type: "tool_result"; tool_use_id: string; content: string }>>
   ```
   - Separate tools into parallel-safe and sequential groups
   - Run all parallel-safe tools with `Promise.all()`
   - Then run sequential tools one by one
   - Return results in original order (important for conversation coherence)

3. Replace the sequential for-loop for `nonWriteTools` with a call to `executeToolsParallel()`.

4. The `PARALLEL_SAFE_TOOLS` set should be a module-level constant:
   ```typescript
   const PARALLEL_SAFE_TOOLS = new Set(["read_file", "grep", "glob", "web_search", "web_fetch", "list_files"]);
   ```

### Success criteria
- When model requests 3 read_file calls simultaneously, they execute via Promise.all (not sequentially)
- Sequential tools (write_file, bash) still run in order
- Results are returned to the model in the same order as the original tool_use blocks
- All existing tests still pass
- At least 3 new tests in `src/__tests__/orchestrator.test.ts` (or new file `src/__tests__/parallel-tools.test.ts`):
  - Test: multiple read-only tools run in parallel (verify with timing or mock)
  - Test: mixed read-only + write tools — reads parallel, writes sequential
  - Test: results maintain original order regardless of execution order

## Goal 2: Tool Error Recovery with Suggestions

When tools fail (file not found, command timeout, permission error), we currently just return the raw error. We should add smart recovery hints.

### Implementation spec

1. Create `src/tool-recovery.ts` with:
   ```typescript
   export interface RecoveryHint {
     error: string;
     suggestion: string;
     alternatives?: string[];
   }
   
   export function enhanceToolError(
     toolName: string,
     input: Record<string, unknown>,
     error: string,
     workDir: string,
   ): string
   ```

2. Recovery strategies by tool:
   - **read_file / write_file** — file not found: fuzzy-match against repo map or run `find` for similar filenames. Return: "File not found: foo.ts. Did you mean: src/utils/foo.ts, src/lib/foo.ts?"
   - **bash** — command not found: suggest `npx` prefix or package install. Timeout: suggest breaking into smaller commands.
   - **grep** — no matches: suggest case-insensitive search or broader glob. Return: "No matches for pattern X. Try: case-insensitive, or search in broader directory."

3. Wire into the tool execution path in orchestrator.ts: when a tool returns an error (starts with "Error:" or similar), pass through `enhanceToolError()` before returning to the model.

4. Keep it lightweight — no additional API calls, just local file system checks (fuzzy match via `fs.readdirSync` or existing repo map data).

### Success criteria
- File-not-found errors include suggested similar filenames
- At least 4 tests in `src/__tests__/tool-recovery.test.ts`:
  - Test: file not found → suggests similar files from directory listing
  - Test: nested path file not found → searches parent directories
  - Test: grep no matches → suggests case-insensitive
  - Test: bash command not found → suggests npx
- All existing tests still pass
- TSC clean

## Verification
- `npx tsc --noEmit` clean
- `npx vitest run` all pass (existing 687+ tests + new tests)
- No regressions in TUI behavior
