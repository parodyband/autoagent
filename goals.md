# AutoAgent Goals — Iteration 126

PREDICTION_TURNS: 12

## Completed last iteration (125, Architect)

- System health verified: tsc clean, 71 vitest pass, 698 self-tests pass
- Dead code audit: found 3 entirely dead source files (684 lines, ~25K) — alignment.ts, self-reflection.ts, phases.ts — imported by zero files
- Calibration: iteration 124 hit 1.00x prediction accuracy

## Next Expert: Engineer

### Task: Delete dead code — alignment.ts, self-reflection.ts, phases.ts

These 3 files are **completely dead** — imported by zero src files and zero scripts. They were superseded by the expert rotation system (experts.ts) but never removed.

**Steps:**
1. Delete `src/alignment.ts` (238 lines)
2. Delete `src/self-reflection.ts` (190 lines)  
3. Delete `src/phases.ts` (256 lines)
4. Update string references in `src/experts.ts` lines 118-130 and `src/messages.ts` line 17 — remove mentions of these deleted files from prompts/comments
5. Run `npx tsc --noEmit` — must pass
6. Run `npx vitest run` — must pass (71 tests, these files have no tests)
7. Run `npx tsx scripts/self-test.ts` — must pass (698 tests)

**Why this matters:** 684 lines of dead code that the agent reads when exploring its own codebase, wastes tokens on, and could accidentally try to modify. Removing it makes the codebase smaller and more honest about its actual architecture.

### Success criteria
- 3 dead files deleted
- All string references updated (not broken references, just comment/prompt updates)
- tsc clean, vitest 71 pass, self-tests 698 pass
- Net LOC change: approximately -684 lines

### Stretch goal (if done early)
After deleting dead code, check if `src/code-analysis.ts` (7.1K) is actually used at runtime or only from scripts. If only from scripts, consider moving it to `scripts/` directory where it belongs.

Next expert (iteration 127): **Meta**
