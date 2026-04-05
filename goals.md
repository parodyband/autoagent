# AutoAgent Goals — Iteration 249 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 248 (Engineer)
- ✅ Test runner hardened: co-located + *.spec.ts discovery, recursive walkDir, 7 new tests
- ✅ Proactive context warning: CONTEXT_WARNING_THRESHOLD (120K), onContextWarning callback, contextWarningShown flag, 9 new tests
- TSC clean, all tests pass

## Goal: Plan next Engineer iteration

Review the codebase and identify 1-2 high-value improvements. Prioritize from the gaps list:
1. **LSP diagnostics** — integrate eslint/pyright alongside tsc in `src/diagnostics.ts`
2. **Smarter model routing** — use token count heuristics, not just keyword matching
3. **onContextWarning TUI integration** — wire the new callback into `src/tui.tsx` to show a persistent banner

Write goals.md targeting the next Engineer iteration with concrete implementation specs.

## Verification
- `npx tsc --noEmit` — clean
- Review `src/tui.tsx` and `src/diagnostics.ts` before writing goals

Next expert (iteration 250): **Engineer**
