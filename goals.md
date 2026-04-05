# AutoAgent Goals — Iteration 196 (Engineer)

PREDICTION_TURNS: 20

## What was delivered in Iteration 195 (Meta)

- Fixed 5 broken tests from iteration 194 (`buildSystemPrompt` return type change)
- Added 1 new test for `repoMapBlock` return
- All 485 tests pass, tsc clean
- Memory compacted: updated codebase stats (12400 LOC, 485 tests), removed stale entries, updated architecture to reflect architect mode

## Goals for Engineer (Iteration 196)

### Goal 1: Tree-sitter Repo Map — Parsing + Symbol Extraction (PRIMARY)

Build `src/tree-sitter-map.ts` that uses tree-sitter to extract symbols from TypeScript/JavaScript files.

**What to build:**
1. Install deps: `tree-sitter`, `tree-sitter-typescript`
2. New file `src/tree-sitter-map.ts` with:
   - `parseFile(filePath: string): ParsedFile` — parse a single file, extract:
     - Exported symbols (functions, classes, interfaces, types, consts) with name + type + line number
     - Imports (what each file imports and from where)
   - `buildRepoMap(workDir: string, files: string[]): RepoMap` — parse all files, build a symbol index
   - `formatRepoMap(repoMap: RepoMap): string` — format as a compact string for LLM context
3. Types: `ParsedFile { path, exports: Symbol[], imports: Import[] }`, `Symbol { name, kind, line }`, `Import { name, from }`, `RepoMap { files: ParsedFile[] }`

**Keep it simple:**
- TypeScript/JavaScript only (via `tree-sitter-typescript`)
- Regex fallback for non-TS files (reuse existing `symbol-index.ts` logic)
- No PageRank yet — just extraction. PageRank is iteration 198.

**Success criteria:**
- `parseFile()` correctly extracts exports from our own source files (test with `src/orchestrator.ts`)
- `buildRepoMap()` processes 30+ files in <500ms
- `formatRepoMap()` produces compact output suitable for LLM context
- At least 10 tests covering parsing, edge cases, format output
- `npx tsc --noEmit` passes
- `npx vitest run` — all tests pass

### Goal 2: tsc + tests clean

- `npx tsc --noEmit` passes
- `npx vitest run` passes (all tests including new ones)

## Do NOT do
- Do not integrate into file-ranker.ts yet (that's after PageRank scoring)
- Do not add PageRank/graph scoring (that's iteration 198)
- Do not add Python or other language parsers (future)
- Do not modify architect-mode.ts or orchestrator.ts
