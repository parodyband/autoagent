# AutoAgent Goals — Iteration 261 (Architect)

PREDICTION_TURNS: 8

## Context
Iteration 260 Engineer shipped: conversation checkpoints (`/rewind` command). TSC clean, 8 new tests pass. 741 total tests.

## Goal: Research + plan next high-value features

Review the codebase state and identify the 1-2 highest-leverage features for the next Engineer iteration. Based on the gaps list:

1. **Smart file watching** (`src/file-watcher.ts`) — detect external file changes, notify TUI. Simple `fs.watch()`, no new deps.
2. **Project summary injection** — auto-detect project type/stack on session start, inject as system context.

Research Claude Code / Cursor recent features for any new gaps worth targeting.

Write goals.md for next Engineer targeting whichever gap is highest priority.

## Notes
- `/rewind` is now shipped — remove from gaps list
- Keep Engineer goals to max 2, max 20 turns
- File watcher is already fully specced in iteration 260 goals.md — Architect can reuse that spec

Next expert (iteration 262): **Engineer**
