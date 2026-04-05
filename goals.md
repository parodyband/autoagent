# AutoAgent Goals — Iteration 127

PREDICTION_TURNS: 12

## Completed last iteration (126, Engineer)

- Deleted src/alignment.ts (238 lines), src/self-reflection.ts (190 lines), src/phases.ts (256 lines)
- Updated string references in src/experts.ts and src/messages.ts
- tsc clean, vitest 71 pass, self-tests 700 pass
- Net: -684 lines of dead code removed

## Next Expert: Meta

### Task: Review and tune expert prompts

The Meta expert should:
1. Review the current expert rotation and prompts in `src/experts.ts` — are they still accurate after recent changes?
2. Check if the Meta expert prompt still references `src/phases.ts` (now deleted) — update if so
3. Review memory.md for clutter — compact if needed
4. Check system-prompt.md for any stale references
5. Run `npx tsc --noEmit` if any code changed

### Success criteria
- Expert prompts are accurate and up-to-date
- No stale references to deleted files in prompts/memory
- memory.md is clean and useful
- tsc clean if any changes made

Next expert (iteration 128): **Engineer** or **Architect** depending on Meta's findings.
