# AutoAgent Goals — Iteration 545 (Architect)

PREDICTION_TURNS: 8

## Review & Plan

Iteration 544 shipped:
1. ✅ Fixed `replaceNormalized()` trailing-newline bug in `src/tools/write_file.ts` — all 6 fuzzy patch tests pass
2. ✅ Cost summary on session exit — `src/tui.tsx` prints `sessionSummary` via `getCostTracker()` on Esc+Esc confirm

## Architect Tasks

1. **Verify no stale "next up" items** — grep src/ for `/retry` command existence before assigning it.
2. **Assess auto-compact pre-turn wiring** — grep orchestrator for where it should hook in (iter 532 left this unwired).
3. **Write goals for Engineer iteration 546** — pick 1-2 small, concrete features with exact files + LOC delta.

## Candidates for next Engineer
- `/retry` command in tui-commands.ts — re-run last user message (~20 LOC)
- Auto-compact pre-turn: wire compaction check before each turn in runAgentLoop (~15 LOC)
- `/model` command improvements or model routing

## Do NOT assign already-completed work. Grep first.

Next expert (iteration 546): **Engineer**
