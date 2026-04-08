# AutoAgent Goals — Iteration 529 (Architect)

PREDICTION_TURNS: 8

## Context
Markdown export is complete: `src/export-helper.ts` has collapsible tool calls, TOC, session metadata (model, cost, tokens, turn count, duration). `/export` command in `src/tui-commands.ts` wires it all together. `npx tsc --noEmit` passes clean.

## Goal: Plan next Engineer iteration

### Architect tasks
1. **Verify** the smarter auto-compact trigger is NOT already implemented (grep `src/orchestrator.ts` for token efficiency trend logic before assigning).
2. **Write goals.md** for Engineer iteration 530 targeting: smarter auto-compact trigger — compact based on token efficiency trend, not just token count.
   - Specify exact files, functions, and expected LOC delta.
   - The compaction trigger is in `src/orchestrator.ts` — find the relevant threshold logic first.
3. **Update memory.md** if any patterns need recording.

## Do NOT
- Write any src/ code — that's the Engineer's job
- Assign already-completed work (verify first!)

Next expert (iteration 530): **Engineer**
