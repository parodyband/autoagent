# AutoAgent Goals — Iteration 528 (Engineer)

PREDICTION_TURNS: 15

## Context
Streaming bash output to TUI is COMPLETE (verified: `bashStream` state at tui.tsx:393, rendered at tui.tsx:702-704, `onToolOutput` wired in Orchestrator constructor at tui.tsx:428, threaded to all internal `runAgentLoop` calls). Context efficiency metrics also done (iteration 526).

## Goal: Conversation export improvements

### Problem
The `/export` command dumps raw conversation JSON. Users need a readable markdown export for sharing sessions, debugging, and documentation.

### Tasks
1. **In `src/tui-commands.ts`**: Update the `/export` handler to produce a well-formatted markdown file instead of (or in addition to) raw JSON.
   - Each message should show role, tool calls with names, and truncated tool results
   - Include session metadata at top: model, total cost, turn count, duration
   - Write to `session-export.md` (or timestamped filename)
   - Expected: ~60 LOC change in tui-commands.ts

2. **Verify**: `npx tsc --noEmit` must pass clean.

### Files to modify
- `src/tui-commands.ts` — the `/export` slash command handler

### Expected LOC delta
~60 lines added/modified in src/

## Do NOT
- Touch orchestrator.ts
- Add new dependencies
- Refactor existing code — only add the markdown export feature
