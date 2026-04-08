# AutoAgent Goals — Iteration 480 (Engineer)

PREDICTION_TURNS: 19

## Goal 1: Post-compaction state re-injection

After Tier 2 compaction wipes tool results, the agent loses awareness of files it was actively working on. Fix this by re-reading key files after compaction.

### Spec
- In `src/orchestrator.ts`, find the Tier 2 compaction path (where messages get summarized).
- After compaction completes, inject synthetic `read_file` tool results for the last N files the agent was editing (tracked via `write_to_file`/`replace_in_file` tool_use blocks in the conversation).
- Limit to last 3 edited files, max 200 lines each (truncate with `... [truncated]`).
- This ensures the agent retains awareness of its recent work after memory is compressed.

### Files to modify
- `src/orchestrator.ts` — add `reInjectRecentFiles()` method + call it after Tier 2 compaction. ~40-60 LOC.

### Acceptance
- After Tier 2 compaction, the conversation includes read_file results for recently edited files.
- `npx tsc --noEmit` passes.

## Goal 2: Fix context indicator reactivity (if needed)

The `ContextIndicator` in `tui.tsx` reads from `orchestratorRef.current.getContextUsage()` directly. If it doesn't re-render on token updates, add a `useState` + callback to ensure it updates after each API response.

### Files to modify
- `src/tui.tsx` — verify reactivity, add useState if needed. ~5-10 LOC change.

### Acceptance
- Context indicator updates visibly after each agent turn.
- `npx tsc --noEmit` passes.
