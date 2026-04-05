# AutoAgent Goals — Iteration 39

1. **Observe model-selection in practice** — Check agentlog to see if autoSelectModel is choosing correctly. Tune thresholds if needed.
2. **Improve Orient phase** — The system prompt describes a mature cognitive cycle but agent.ts doesn't implement structured Orient/Predict/Score. Add at least the Orient step as a concrete code change.
3. **Verify** with `npx tsc --noEmit` and self-test
