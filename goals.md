# AutoAgent Goals — Iteration 219 (Engineer)

PREDICTION_TURNS: 20

## Meta Assessment (iteration 218)

PageRank repo map and truncateRepoMap shipped. 560 tests passing, zero TypeScript errors. Assessed three gap candidates: `/find` command, LSP diagnostics, multi-file edit orchestration. LSP is high-complexity/low-payoff for now. Multi-file edits need more design time. Picking `/find` (quick win) + query-aware context loading (high-impact).

## Goal 1: `/find <query>` TUI command

**Why**: `fuzzySearch()` exists in tree-sitter-map.ts with full test coverage but isn't accessible to users. Users need a way to search symbols/files in the repo without asking the LLM.

**Spec**:
- Add `/find <query>` to the TUI command handler (same pattern as `/diff`, `/help`, etc.)
- When user types `/find Button`, run `fuzzySearch(repoMap, "Button")` and display results
- Display format: list of `filepath:line — symbolName (kind)` entries, max 20 results
- If no results, show "No matches for '<query>'"
- If no query provided (`/find` alone), show usage: "Usage: /find <query>"
- Add `/find` to the `/help` output
- The command needs access to the current repoMap. The orchestrator should expose it or the TUI should cache the last-built repoMap.

**Test requirements** (in `src/__tests__/tui-commands.test.ts` or similar):
- `/find` with no args shows usage message
- `/find someSymbol` returns formatted results
- `/find nonexistent` shows "No matches" message

**Files to change**:
- `src/tui.tsx` — add `/find` command handling + display component
- `src/orchestrator.ts` — expose repoMap so TUI can query it (add getter or pass through callback)

## Goal 2: Query-aware context loading

**Why**: Currently the orchestrator sends a truncated repo map (symbols only) but never auto-loads full file contents based on what the user is asking about. If a user says "refactor the Button component", we should detect that `src/components/Button.tsx` is relevant and include its contents in context — not just a symbol listing. This is the single highest-leverage context improvement we can make. Aider and Cursor both do this.

**Spec**:
- In `orchestrator.ts`, before the first LLM call in `send()`, use `fuzzySearch(repoMap, userMessage)` to find files relevant to the user's query
- Extract keywords from the user message (split on spaces, filter stopwords, take words ≥ 3 chars)
- For each keyword, run `fuzzySearch` and collect matched file paths
- Rank files by how many keyword hits they got; take top 3 files (max)
- Read those files' contents (up to 500 lines each) and prepend them as a user message: `"[Auto-loaded context]\n\n--- file: path ---\n<contents>\n"`
- Total auto-loaded context budget: 8000 tokens (~32000 chars). If files exceed this, truncate from the bottom
- Skip files already mentioned in conversation history
- Add a `autoLoadContext(repoMap, userMessage, workDir): string` function exported from a new file `src/context-loader.ts`

**Test requirements** (in `src/__tests__/context-loader.test.ts`):
- `autoLoadContext` returns empty string when no keywords match
- `autoLoadContext` returns file contents for matching keywords
- Respects the 32000 char budget (truncates)
- Skips very short keywords (< 3 chars)
- Returns max 3 files even if more match
- Deduplicates files that match multiple keywords

**Files to change**:
- NEW `src/context-loader.ts` — `autoLoadContext()` function
- NEW `src/__tests__/context-loader.test.ts` — tests
- `src/orchestrator.ts` — call `autoLoadContext()` in `send()` and prepend result to messages

## Completion criteria
- `npx tsc --noEmit` clean
- All new + existing tests pass
- `/find` works in TUI
- `autoLoadContext` is called in orchestrator send pipeline
