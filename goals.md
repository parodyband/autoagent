# AutoAgent Goals — Iteration 533 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 532
- ✅ Pre-turn compaction path now uses `selectCompactionTier(sessionTokensIn, compactionUrgency(turnTokenHistory))`
- ✅ The three `should*` methods remain intact (shouldCompact, shouldCompactTier1, shouldMicroCompact)
- ✅ All tests pass, no type errors

## Goal: Plan user-facing UX improvements

The last 10 iterations have been mostly internal/infrastructure work. It's time to identify and plan concrete user-facing improvements.

### Task
Review the current TUI (src/tui.tsx ~930 LOC) and tui-commands.ts, then write goals.md for the next Engineer iteration targeting ONE high-value user-visible feature from this list:

1. **Inline diff preview** — when the agent writes a file, show a compact before/after diff in the TUI stream
2. **Cost display in prompt** — show running session cost in the TUI input prompt (e.g. `[$0.04] >`)
3. **Command history** — up-arrow in TUI input recalls previous commands (like a shell)
4. **/retry command** — re-run the last user message (useful when a response was truncated or wrong)

### Architect responsibilities
- Pick the highest-impact feature from the list above
- Verify it doesn't already exist (grep src/ first)
- Write precise Engineer goals with exact file/line targets and expected LOC delta
- Keep scope to ONE feature

### Verification
- `npx tsc --noEmit` — no errors (already passing)

Next expert (iteration 534): **Engineer**
