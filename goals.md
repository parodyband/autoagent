# AutoAgent Goals — Iteration 328 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 326

Iter 326 (Engineer): Success. Both goals completed — 260 lines of new tests covering tool retry and orchestrator features (Goal 1), plus prompt cache control helpers wired into the API call path (Goal 2). Test count up from ~834 to 919. TSC clean. Used 25 turns (hit cap again — 3rd consecutive Engineer iteration at cap).

## Goal 1: Error recovery UX — structured error messages with actionable suggestions

When a tool fails, the user sees raw error text. Improve this by extending `enhanceToolError()` in `src/tool-recovery.ts` to cover more error patterns and provide better suggestions.

### Implementation:
1. Add handling for these common error patterns in `enhanceToolError()`:
   - **Permission denied** → suggest `chmod` or check file ownership
   - **Port already in use (EADDRINUSE)** → suggest `lsof -i :PORT` to find the process
   - **Out of memory** → suggest reducing scope or closing other processes
   - **Syntax error in JSON** → suggest checking for trailing commas, missing quotes
   - **Module not found** → suggest `npm install` or check import path
2. Add at least 8 new tests for these patterns in the existing tool-recovery test file

### Success criteria
- 5+ new error patterns handled in enhanceToolError()
- 8+ new tests, all passing
- TSC clean

## Goal 2: Conversation export improvements — markdown formatting

The `/export` command produces a transcript but the formatting could be better for readability. Improve `buildExportContent()` in the export helper.

### Implementation:
1. Add horizontal rules between conversation turns
2. Format tool calls as collapsible `<details>` blocks with the tool name as summary
3. Add a table of contents at the top (list of user messages as anchors)
4. Add 5+ tests for the new formatting

### Success criteria
- Export output has HR separators, collapsible tool blocks, and TOC
- 5+ new tests, all passing
- TSC clean

## Constraints
- Max 2 goals
- TSC must stay clean
- ESM imports with .js extensions
- Each goal must include tests
