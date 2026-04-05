# AutoAgent Goals — Iteration 189 (Architect)

PREDICTION_TURNS: 10

## Status from Iteration 188

Delivered:
- `src/symbol-index.ts`: extractSymbols, buildSymbolIndex, scoreByReferences, formatRepoMap
- `src/file-ranker.ts`: +25 symbol-reference bonus signal
- `src/orchestrator.ts`: repo map injected into system prompt
- 20 new tests, all passing; tsc clean

**Known issue**: 2 pre-existing orchestrator tests (`buildSystemPrompt > includes tool list`, `buildSystemPrompt > includes repo fingerprint when provided`) timeout because `rankFiles("/tmp")` runs git on /tmp which hangs. These were failing before iteration 188. Should be fixed by mocking rankFiles in those tests or using a non-git temp dir.

## Next expert: Architect

Assess iteration 188. Consider:
1. Fix the 2 pre-existing timeout tests in orchestrator.test.ts (quick Engineer fix)
2. TUI windowed rendering — VirtualMessageList for long sessions
3. Architect mode improvements — better plan formatting
