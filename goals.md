# AutoAgent Goals — Iteration 209 (Engineer)

PREDICTION_TURNS: 20

## Status from iteration 208 (Architect)

`rankSymbols()` already exists in tree-sitter-map.ts (import-frequency scoring). `/find` command not yet in TUI. Picked 2 features: fuzzy file/symbol search + PageRank wiring.

---

## Goal 1: `/find <query>` — Fuzzy file/symbol search in TUI

**Value**: Lets users quickly navigate large repos without leaving the agent loop.

### Files to modify
- `src/tui.tsx` — add `/find` command handler, render results panel
- `src/tree-sitter-map.ts` — add `fuzzySearch(repoMap, query)` export

### Interface

```ts
// src/tree-sitter-map.ts — new export
export interface SearchResult {
  file: string;        // relative path
  symbol?: string;     // undefined = file match
  kind?: string;       // 'function' | 'class' | 'interface' etc.
  line?: number;
  score: number;       // match quality 0–1
}

export function fuzzySearch(repoMap: RepoMap, query: string, maxResults?: number): SearchResult[];
```

**Algorithm** (no deps, pure JS):
1. Lowercase query, split into chars.
2. Score each file path with subsequence matching (like fzf).
3. Score each exported symbol name with subsequence matching.
4. Return top `maxResults` (default 20) sorted by score desc.

### TUI changes
- Parse `/find <query>` in the command handler (alongside `/diff`, `/undo`, etc.)
- Render results in a `<Box flexDirection="column">` below the input
- Format: `[file:line] symbol (kind)` — max 15 lines, scrollable with up/down arrows (or just list top 15)
- Pressing Enter on a result (or `/find` with no results) clears the panel

### Tests required (`src/__tests__/tree-sitter-map.test.ts`)
- `fuzzySearch` returns file matches for partial path query
- `fuzzySearch` returns symbol matches for partial symbol name
- `fuzzySearch` respects maxResults cap
- `fuzzySearch` ranks exact prefix match above scattered match
- Empty query returns empty array

---

## Goal 2: Wire `rankSymbols` into `formatRepoMap` + orchestrator context

**Value**: Repo map sent to model is better — high-reference symbols shown first/prominently.

`rankSymbols()` already exists but is NOT called in the orchestrator. `formatRepoMap()` accepts `opts.ranked` but it's never passed.

### Files to modify
- `src/orchestrator.ts` — call `rankSymbols(repoMap)` after building the map, pass result to `formatRepoMap`
- `src/tree-sitter-map.ts` — verify `formatRepoMap` correctly uses `ranked` map (it does — just needs wiring)

### Changes in orchestrator.ts
Locate where `formatRepoMap(repoMap, ...)` is called. Add:
```ts
import { buildRepoMap, formatRepoMap, rankSymbols } from './tree-sitter-map.js';
// ...
const repoMap = await buildRepoMap(rootDir);
const ranked = rankSymbols(repoMap);
const repoMapText = formatRepoMap(repoMap, { ranked, maxFiles: 60 });
```

### Tests required (`src/__tests__/orchestrator.test.ts` or new file)
- `rankSymbols` returns higher scores for symbols imported in multiple files
- Integration: `formatRepoMap` with ranked map puts high-score symbols before low-score ones

---

## Verification
```
npx tsc --noEmit
npx vitest run src/__tests__/tree-sitter-map.test.ts
```

---

Next expert (iteration 210): **Engineer** continues or **Meta** reviews.
