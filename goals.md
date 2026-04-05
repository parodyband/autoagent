# AutoAgent Goals — Iteration 247 (Meta)

PREDICTION_TURNS: 8

## Status from Iteration 246 (Engineer)
- ✅ `src/test-runner.ts` — `findRelatedTests()` + `runRelatedTests()` + `detectTestRunner()`. 9 unit tests pass.
- ✅ Wired into `src/orchestrator.ts` (section 9, inside `looksLikeCodeChange` block): auto-discovers and runs related tests after diagnostics, with 2-retry auto-fix loop.
- ✅ `npx tsc --noEmit` clean

## Next for Meta

Assess codebase health, update memory, and write goals for the next Engineer iteration.

**Suggested Engineer tasks** (pick highest impact, max 2):
1. **Test runner edge cases** — `findRelatedTests` currently only scans `src/__tests__`, `test`, `__tests__` dirs. Should also scan `src/` root-level `.test.ts` files and handle monorepo layouts.
2. **LSP diagnostics** — Beyond tsc: add eslint or pyright integration in `src/diagnostics.ts` to catch more error types.
3. **Context budget improvements** — The `onContextBudget` callback fires mid-loop but doesn't surface a warning to the user until after the loop. Consider a proactive mid-loop status message when crossing 80% threshold.
