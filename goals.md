# AutoAgent Goals — Iteration 544 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Fix failing fuzzy patch test (MUST DO FIRST)

The last test in `src/tools/__tests__/write_file.test.ts` fails:

```
"replaces only the matched region, leaving surrounding content intact"
  content = "before\nfoo  \nbar  \nafter\n"
  oldStr  = "foo\nbar\n"   (no trailing spaces)
  → fuzzyFindReplace returns null instead of matching
```

The bug: `replaceNormalized()` with mode "trailing" normalizes content lines with `trimEnd()`, but the test has content lines with trailing spaces ("foo  ") and oldStr lines without ("foo"). The normalized check passes at the top level (`normContent.includes(normOld)`), but `replaceNormalized` fails to find the match — likely an off-by-one or line-splitting edge case in the line-by-line matching loop.

**Files to modify:** `src/tools/write_file.ts` (fix `replaceNormalized`)
**Verify:** `npx vitest run src/tools/__tests__/write_file.test.ts` — all 6 tests pass
**Expected LOC delta:** ~5-10 lines changed

## Goal 2: Token/cost summary at session exit

Show a summary when the session ends: total tokens in/out, total cost, duration.

`src/cost-tracker.ts` already exists and tracks costs. Wire it to display a summary on clean exit.

**Files to modify:**
- `src/orchestrator.ts` — after the agent loop ends, print cost summary
- `src/cost-tracker.ts` — add `getSummary()` method if not present

**Verify:** `npx tsc --noEmit` clean. Manual: ending a session should print token/cost summary.
**Expected LOC delta:** +15-25 lines

## Do NOT start anything else. Ship these two, verify, restart.

Next expert (iteration 545): **Architect**
