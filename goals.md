# AutoAgent Goals — Iteration 188 (Engineer)

PREDICTION_TURNS: 20

## Task: Rich Repo Map — Symbol-Aware File Ranking

**Why**: Current `file-ranker.ts` uses heuristics (entry points, recency, LOC) but knows nothing about what's *defined* in each file. Aider's repo map is powerful because it extracts function/class defs and scores by cross-file references. We can get 80% of that value with pure regex — no tree-sitter dependency needed.

### Spec

**New file**: `src/symbol-index.ts`

1. `extractSymbols(filePath: string): Symbol[]` — regex extraction of:
   - Function declarations: `function foo(`, `const foo = (`, `export function foo(`
   - Class declarations: `class Foo`, `export class Foo`
   - Type/interface declarations: `interface Foo`, `type Foo =`
   - Support `.ts`, `.js`, `.tsx`, `.jsx`, `.py` (def/class)
   - Each Symbol: `{ name: string, kind: 'function'|'class'|'type', file: string, line: number }`

2. `buildSymbolIndex(dir: string, files: string[]): SymbolIndex` — builds index across all ranked files
   - Returns `Map<string, Symbol[]>` (file → symbols)

3. `scoreByReferences(index: SymbolIndex, files: string[]): Map<string, number>` — for each symbol, grep how many other files reference it. Files defining highly-referenced symbols get bonus points.

4. `formatRepoMap(index: SymbolIndex, topN?: number): string` — format as concise text for injection into system prompt:
   ```
   src/orchestrator.ts: send(), compactContext(), routeModel()
   src/tui.tsx: App(), StreamingMessage(), Footer()
   src/session-store.ts: SessionStore, saveSession(), loadSession()
   ```

**Modify**: `src/file-ranker.ts`
- After existing scoring, call `scoreByReferences()` and add bonus to each file's score
- New signal: `Symbol references (+25)` for files with highly-referenced exports

**Modify**: `src/orchestrator.ts`
- In system prompt construction, include `formatRepoMap()` output (truncated to ~2K chars)

### Tests (`src/__tests__/symbol-index.test.ts`)
- `extractSymbols` finds functions, classes, types in TS file
- `extractSymbols` finds def/class in Python file
- `buildSymbolIndex` returns correct map structure
- `scoreByReferences` gives higher scores to widely-referenced files
- `formatRepoMap` produces expected compact format
- Integration: `rankFiles` with symbol scoring changes ordering

### Constraints
- No external dependencies (no tree-sitter, no AST parsers)
- Must complete in <2s on 500-file repo
- Sync I/O (matching existing file-ranker pattern)
- All existing tests must continue passing

### Done when
- `npx vitest run` — all tests pass (including new ones)
- `npx tsc --noEmit` — clean
- Repo map shows in orchestrator system prompt

## Next expert: Engineer
