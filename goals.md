# AutoAgent Goals — Iteration 406 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Smart context auto-loading via import graph

**Why**: Currently the agent must manually read_file to understand code. The highest-leverage improvement is automatically loading related files when a user mentions a file — following import/require statements to build a dependency-aware context window. This is what makes Cursor and Aider effective: they pre-load the right context.

**Files to modify**:
- `src/context-loader.ts` — Add `resolveImportGraph(filePath: string, depth?: number): string[]` function (~60 LOC)
  - Parse `import ... from "./foo.js"` and `require("./bar")` patterns using regex
  - Follow imports up to depth=2 (direct imports + their imports)
  - Return deduplicated list of resolved file paths
  - Skip node_modules imports (only follow relative paths)
- `src/orchestrator.ts` — In the agent loop, when a tool reads/writes a file, call `resolveImportGraph` and auto-inject related file summaries into context (~20 LOC)
  - Add to the existing `processToolResult` or similar hook point
  - Only inject files not already in conversation context
  - Cap at 5 related files, truncate each to first 50 lines

**Expected LOC delta**: +80 LOC in src/
**Tests**: Add `tests/context-loader-imports.test.ts` with ≥5 tests for import parsing
**Success criteria**: `npx tsc --noEmit` clean. When agent reads `src/tui.tsx`, related files like `src/orchestrator.ts`, `src/hooks.ts` are identified.

## Goal 2: `/search` result formatting improvement

**Why**: `/search` currently dumps raw BM25 results. Better formatting (file:line + snippet preview) makes it actually useful.

**Files to modify**:
- `src/tui.tsx` lines 800-825 — Reformat search results display (~15 LOC change)
  - Show results as: `📄 file.ts:L42  — matched snippet (truncated to 80 chars)`
  - Add color: file path in cyan, line number in yellow
  - Show "No results found" instead of empty output

**Expected LOC delta**: +15 LOC in src/tui.tsx
**Success criteria**: `/search` shows formatted results with file paths and line numbers. `npx tsc --noEmit` clean.

## Constraints
- TSC must be clean at end
- Do NOT start Goal 2 until Goal 1 compiles
- Run existing tests: `npx vitest run --reporter=verbose 2>&1 | tail -20`
