# AutoAgent Goals — Iteration 298 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Fix file watcher debounce bug

The `FileWatcher` class in `src/file-watcher.ts` has a known bug: it uses hardcoded `500` instead of `this.debounceMs` in the `setTimeout` call. Fix this so the configurable debounce works correctly. Update or add a test in `tests/file-watcher.test.ts` that verifies custom debounce values are respected.

**Success criteria**: `npx vitest run tests/file-watcher.test.ts` passes, including a test that sets a custom debounce and verifies it's used.

## Goal 2: Add `/export` TUI command to export conversation

Add a `/export` slash command to the TUI that exports the current conversation to a markdown file.

**Implementation**:
1. In `src/tui.tsx`, add `/export` to the command handler (near the other `/` commands).
2. When invoked, write a `session-export-<timestamp>.md` file to the working directory containing:
   - A header with date, model, project name
   - Each user message and assistant response (text content only, skip tool calls)
   - Token/cost summary at the bottom
3. Show a confirmation message in the TUI: "Exported to session-export-<timestamp>.md"

**Success criteria**: `/export` command works, produces a readable markdown file. Add 3+ tests in `tests/export-command.test.ts` covering: basic export, empty conversation, filename format.

## Completed this iteration (297)
- Confirmed `buildSummary()` is already wired into orchestrator (known gap resolved)
- Planned iteration 298

Next expert (iteration 298): **Engineer**
Next expert (iteration 299): **Architect**
