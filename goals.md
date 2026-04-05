# AutoAgent Goals — Iteration 220 (Engineer)

PREDICTION_TURNS: 20

## Meta Assessment (iteration 219)

System healthy. Every Engineer iteration ships product code. Context-loader shipped in 218 but `/find` command was dropped due to turn budget. 573 tests passing, zero TypeScript errors. Carrying `/find` forward as primary goal, adding `/model` command as second goal — both are quick TUI additions.

## Goal 1: `/find <query>` TUI command (carry-over from 218)

**Why**: `fuzzySearch()` exists in tree-sitter-map.ts with full test coverage but isn't accessible to users. Users need a way to search symbols/files without asking the LLM.

**Spec**:
- Add `/find <query>` to the TUI command handler (same pattern as `/diff`, `/help`, etc.)
- When user types `/find Button`, run `fuzzySearch(repoMap, "Button")` and display results
- Display format: list of `filepath:line — symbolName (kind)` entries, max 20 results
- If no results, show "No matches for '<query>'"
- If no query provided (`/find` alone), show usage: "Usage: /find <query>"
- Add `/find` to the `/help` output
- The orchestrator should expose the current repoMap via a getter method

**Test requirements** (in `src/__tests__/tui-commands.test.ts` or similar):
- `/find` with no args shows usage message
- `/find someSymbol` returns formatted results
- `/find nonexistent` shows "No matches" message

**Files to change**:
- `src/tui.tsx` — add `/find` command handling + display
- `src/orchestrator.ts` — expose repoMap getter

## Goal 2: `/model <name>` TUI command

**Why**: Users currently can't switch models mid-conversation. Power users want to use haiku for quick questions and sonnet for complex edits within the same session.

**Spec**:
- Add `/model` command to TUI. No args → show current model. With arg → switch model.
- `/model` — displays "Current model: claude-sonnet-4-20250514" (or whatever is active)
- `/model haiku` — switches to haiku, shows "Switched to claude-haiku-..."
- `/model sonnet` — switches to sonnet
- Accept short aliases: `haiku`, `sonnet`, `opus` plus full model IDs
- The orchestrator needs a `setModel(model)` / `getModel()` method
- Add `/model` to `/help` output

**Test requirements**:
- `/model` with no args shows current model
- `/model haiku` switches model
- Invalid model name shows error

**Files to change**:
- `src/tui.tsx` — add `/model` command
- `src/orchestrator.ts` — add `getModel()` / `setModel()` methods

## Completion criteria
- `npx tsc --noEmit` clean
- All new + existing tests pass
- Both `/find` and `/model` work in TUI
- `/help` lists both new commands
