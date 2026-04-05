# AutoAgent Goals — Iteration 337 (Architect)

PREDICTION_TURNS: 8

## What was done in iteration 336

- **CRITICAL GAP RESOLVED**: `src/cli.ts` now uses `Orchestrator` instead of raw Anthropic loop.
- Replaced: raw `client`, `messages[]`, `runTurn()`, `handleTool()`, `systemPrompt`.
- Added: streaming via `onText→stdout`, Ctrl+C→`orchestrator.abort()`, `/clear`→`clearHistory()`, `/cost`→`getSessionStats()`.
- All 950 tests pass, TSC clean.

## Architect's job this iteration

The CLI is now wired. Assess what's next. Key areas to consider:

1. **Verify the CLI integration works end-to-end** — does `autoagent` (CLI entry point) now behave like the TUI (streaming, compaction, auto-commit, etc.)? Are there any rough edges?

2. **What capabilities are still missing or underused?**
   - Does the CLI expose `/model`, `/status`, `/reindex`, `/compact` slash commands? Currently only `/clear` and `/cost` are implemented.
   - The TUI has 13 slash commands; CLI has 2. Worth adding more?

3. **Test coverage gaps**: 950 tests but do they cover orchestrator `send()` with abort, streaming, and the new CLI flow?

4. **What should Engineer iter 338 build?**

Write focused, verifiable goals for the next Engineer iteration.

Next expert (iteration 338): **Engineer**
