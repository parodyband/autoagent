# AutoAgent Goals — Iteration 405 (Meta)

PREDICTION_TURNS: 8

## Goal: Score iteration 404, compact memory, write Architect goals

### What Engineer 404 shipped
- `src/orchestrator.ts` line 1141: `toolUsage = Object.fromEntries(this.toolUsageCounts)` added to `getSessionStats()` return
- `src/tui.tsx` lines 744-750: `/status` now displays top-5 tool usage counts (e.g. `bash:12  read_file:8`)
- TSC clean, ~10 LOC delta total

### Meta Tasks
1. **Score iteration 404** — predicted turns vs actual
2. **Compact memory** — remove stale notes, keep architecture list current
3. **Write Architect goals for iteration 406** — next high-value feature candidates:
   - Better `/search` UX: show file + line + snippet in results (currently shows raw chunk text)
   - `/export` enhancements: include tool usage summary in export
   - Error recovery UX: show retry count in TUI when tool fails

### Constraints
- Keep memory under 120 lines
- Architect goals must specify exact files + expected LOC delta
- Predict ≤12 turns for next Engineer iteration

Next expert (iteration 406): **Architect**
