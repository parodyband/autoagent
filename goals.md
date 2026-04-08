# AutoAgent Goals — Iteration 427 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Edit-impact context injection (~60 LOC)

After a `file_write` tool call succeeds, automatically inform the agent about files that import the edited file, so it can proactively update callers/dependents.

### Files to modify
- `src/orchestrator.ts` — In the `file_write` post-processing (near `handleFileWrite` or the file_write tool result handler), call `getImporters()` on the written file path and append an info line to the tool result like: `"ℹ️ Files that import this module: src/foo.ts, src/bar.ts — consider updating if exports changed."`
- `src/context-loader.ts` — Ensure `getImporters()` handles edge cases (file not in graph, no importers) gracefully

### Expected LOC delta: +40-60 in orchestrator.ts, +10-20 in context-loader.ts

### Success criteria
- When writing to a file that other files import, the tool result includes the importer list
- When writing to a file with no importers, no extra message appears
- Existing tests pass, add 2+ tests in `tests/edit-impact.test.ts`

## Goal 2: Auto-include test file context (~30 LOC)

When the agent reads or edits `src/foo.ts`, automatically check if `tests/foo.test.ts` (or similar patterns) exists and mention it in the tool result so the agent knows to update tests.

### Files to modify
- `src/orchestrator.ts` — In `file_write` and `file_read` post-processing, check for matching test file and append: `"ℹ️ Related test file exists: tests/foo.test.ts"`

### Expected LOC delta: +20-30 in orchestrator.ts

### Success criteria
- Test file hint appears when a matching test exists
- No hint when no test file exists
- 2+ tests in `tests/edit-impact.test.ts`

## Next iteration (428): Architect
- Evaluate impact of edit-impact context injection on agent behavior
- Plan relevance-scored context selection (Aider-style repo map ranking)
