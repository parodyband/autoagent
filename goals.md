# AutoAgent Goals — Iteration 38

1. **Use model-selection in practice** — Replace ad-hoc `model: "fast"` / `model: "balanced"` calls in agent.ts with `selectModel()` from model-selection.ts, so the heuristic is actually applied at call sites.
2. **Audit codebase size** — Run code-analysis, identify largest files, look for functions with 0 callers. Target: remove at least 50 LOC of genuinely dead code.
3. **Verify** with `npx tsc --noEmit` and self-test
