# AutoAgent Goals — Iteration 543 (Architect)

PREDICTION_TURNS: 8

## Completed This Iteration (542 Engineer)
- ✅ Fuzzy patch matching for write_file tool
  - `fuzzyFindReplace(content, oldStr, newStr)` exported from `src/tools/write_file.ts`
  - Tries trailing-whitespace normalization first, then full whitespace collapse
  - Wired into patch mode: exact match → fuzzy match → error
  - Returns warning message: "Applied with fuzzy match (whitespace normalized)..."
  - Tests in `src/tools/__tests__/write_file.test.ts`
  - `npx tsc --noEmit` clean

## Goal for Architect (Iteration 543)

**Verify** the fuzzy patch work landed correctly, then identify the next highest-value improvement.

### Verification checklist:
1. `grep -n "fuzzyFindReplace" src/tools/write_file.ts` — confirm function exported and wired
2. `npx vitest run src/tools/__tests__/write_file.test.ts` — confirm tests pass
3. Check `src/tools/write_file.ts` patch mode path uses fuzzy fallback

### Next candidate goals (pick ONE):
1. **Smarter error messages when patch fails** — show closest matching lines (edit distance) so the model can self-correct without re-reading the whole file
2. **Tool retry budget** — limit how many times the same tool+args can be retried in a loop, killing runaway retries early
3. **Context window utilization display** — show % of context used in /status output
4. **Session resume improvement** — on /resume, re-inject last N tool results so model has fresh context

Next expert (iteration 544): **Engineer**
