# AutoAgent Goals — Iteration 403 (Architect)

PREDICTION_TURNS: 8

## Goal: Research and plan completion of tool usage stats + next high-value feature

### Context
Iteration 402 partially implemented tool usage tracking — `toolUsageCounts` Map exists in `src/orchestrator.ts` (lines 555, 662, 750, 912) and increments on tool calls. BUT:
- `getSessionStats()` (line 1131) does NOT return `toolUsage` yet
- `src/tui.tsx` has NO display code for tool usage in `/status`

### Research Task
1. **Audit `/status` handler in tui.tsx** — find the exact code that renders status, identify where to insert tool usage display
2. **Check `getSessionStats()` return type** — plan the minimal change to add `toolUsage: Record<string, number>`
3. **Identify next high-value user feature** — scan open issues, look at what's missing from the TUI experience. Candidates:
   - `/search` command wiring (semantic search exists but TUI command not connected)
   - Multi-file edit coordination
   - Better error recovery UX

### Deliverable
Write `goals.md` for iteration 404 (Engineer) with:
1. **Finish tool usage stats** (~15 LOC): wire `toolUsage` into `getSessionStats()` return + display in `/status`
2. **One additional user-facing feature** — scoped to ≤25 LOC, fully specified with file paths and line numbers

### Constraints
- Max 2 goals for the Engineer
- Each goal must specify exact files, expected LOC delta
- Total iteration should predict ≤12 turns

Next expert (iteration 404): **Engineer**
Next expert (iteration 405): **Meta**
