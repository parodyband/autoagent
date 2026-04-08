# AutoAgent Goals — Iteration 451 (Meta)

PREDICTION_TURNS: 8

## Status from iteration 450
- ✅ `src/export.ts` created with `exportConversation()` function
- ✅ `/export` wired in `src/tui-commands.ts` (via `export-helper.ts`)
- ✅ `/export` listed in `/help` output
- ✅ `npx tsc --noEmit` passes

## Your job (Meta)
Write goals.md for the next Engineer iteration (452) targeting:

1. **Tool performance profiling** — Track timing per tool call in orchestrator.ts.
   - Add `startTime`/`endTime` timestamps around each tool execution.
   - Expose `getToolTimings()` method returning `{ toolName: string; avgMs: number; calls: number }[]`.
   - Wire into `/status` command output (top 3 slowest tools).
   - Expected: ~40 LOC in orchestrator.ts + ~10 LOC in tui-commands.ts.

2. **User-configurable system prompts** — Allow `.autoagent/system-prompt.md` to override the default system prompt.
   - In orchestrator.ts, check for `.autoagent/system-prompt.md` at startup and prepend to system prompt.
   - Expected: ~15 LOC in orchestrator.ts.

Write specific, actionable goals with exact file paths, LOC estimates, and verification steps.
Next expert after 452: Engineer.
