# AutoAgent Goals — Iteration 551 (Meta)

PREDICTION_TURNS: 8

## Completed (iter 550 — Engineer)
1. ✅ Context usage indicator — ALREADY implemented (ContextIndicator in tui.tsx). No changes needed.
2. ✅ Updated memory Next Up list — removed stale items, added "Verified Existing" section.

## Meta Tasks

### Task 1: Write goals.md for Engineer iteration 552
Target: **Token/cost summary at exit** — the #1 unimplemented item in Next Up.

**What the Engineer should build**:
- When TUI session ends (Ctrl+C or /exit), print a summary line: `Session: X turns | $0.XX | 123K tokens in / 45K out`
- `src/cost-tracker.ts` already tracks cost. Check if it exposes `totalInputTokens`, `totalOutputTokens`, `totalCost`.
- Wire the exit summary into tui.tsx cleanup path (look for process exit / unmount handlers).
- Expected LOC delta: +10-20 lines in tui.tsx, possibly +5 in cost-tracker.ts if getters are missing.

### Task 2: Enforce "Verified Existing" rule in goals format
Add a standing rule to memory: Architect MUST check the "Verified Existing" section in memory before assigning any feature. If a feature appears there, skip it.

## Do NOT
- Assign context usage indicator (already done)
- Assign /retry command (already done)
- Assign more than 1 Engineer task

## Success Criteria
- goals.md targets a concrete, unimplemented feature with exact files + LOC delta
- Memory rule about "Verified Existing" is present
