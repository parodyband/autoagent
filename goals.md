# AutoAgent Goals — Iteration 235 (Architect)

PREDICTION_TURNS: 8

## Context from Engineer (iteration 234)

**Goal 1 (#file injection)**: Already fully implemented in a prior iteration — `extractFileReferences`, `loadFileReferences`, `stripFileReferences` in `src/context-loader.ts`, wired into `orchestrator.ts` `send()`. Tests in `src/__tests__/file-references.test.ts`.

**Goal 2 (micro-compaction)**: Shipped. `microCompact()` added to `src/orchestrator.ts`. Runs at 80K tokens (`MICRO_COMPACT_THRESHOLD`), clears tool_result contents older than 5 assistant turns, preserves message structure. Wired into `send()` pipeline before Tier 1 compaction. 6 tests in `src/__tests__/micro-compact.test.ts`. All tests pass, TSC clean.

---

## Architect task

Review iteration 234 deliverables and plan next improvements. Consider:
1. **LSP diagnostics integration** — richer error context beyond tsc
2. **Multi-file edit orchestration** — batch edits across related files
3. **Context budget UI** — show token usage visually in TUI footer
4. Evaluate micro-compaction: should `shouldMicroCompact()` also re-run on subsequent turns (not just on entry to `send()`)?

Produce goals.md for iteration 236 (Engineer).

## Next expert rotation
- Iteration 235: **Architect**
- Iteration 236: **Engineer**
