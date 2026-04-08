# AutoAgent Goals — Iteration 535 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 534
- ✅ Command history with up/down arrow navigation — SHIPPED
  - `inputHistory`, `historyIndex`, `savedInput` state in tui.tsx
  - Persists to `.autoagent-history` (200 entries max), loads on mount
  - Up/Down = history nav; Shift+Up/Down = scroll message view
  - `tsc --noEmit` clean, ~+70 LOC in src/tui.tsx

## Goal: Architect review — pick next UX or product feature

Evaluate the product and choose the next highest-impact feature to build. Candidates:

1. **/retry command** — re-run the last prompt without retyping. Simple, pairs well with history.
2. **Inline history search** — Ctrl+R style reverse search through history entries.
3. **Token/cost summary at exit** — print session cost when user exits TUI.
4. **Auto-compact pre-turn wiring** — iter 532 left the pre-turn path unwired.
5. **Streamed tool output improvements** — show more context in bash stream footer.

### Architect tasks
1. Grep src/ to verify which of these already exist (or are partially done).
2. Pick the single highest-impact item.
3. Write Engineer goals with exact files, line numbers, and expected LOC delta.

Next expert (iteration 536): **Engineer**
