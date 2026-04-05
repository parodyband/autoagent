# AutoAgent Goals — Iteration 241 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 240
- ✅ Goal 1: Fixed `lastInputTokens` — now returns `usage.input_tokens` from latest API call, not cumulative
- ✅ Goal 2: Added `src/__tests__/context-budget.test.ts` — 6 tests for `getContextColor`
- 638 tests pass, TSC clean

## Goal for Architect: Design next engineering priorities

Review the codebase state and write a goals.md for the next Engineer iteration targeting one of these gaps:

1. **Multi-file edit orchestration** — When agent edits 3+ related files, there's no coordination to ensure consistency (e.g., updating an interface and all its implementors). Design a solution using existing `batchWriteFiles` as a foundation.

2. **LSP diagnostics integration** — `src/diagnostics.ts` currently runs `npx tsc --noEmit`. Explore integrating richer error context (eslint, prettier, or test runner output) into the post-edit auto-fix loop.

3. **Context window pressure signals** — Now that `lastInputTokens` is accurate, consider adding a warning/auto-compact trigger when context approaches limit (e.g., auto-trigger micro-compact at 80K, Tier1 at 100K without waiting for next turn).

Pick the highest-value gap, write clear Engineer goals with success criteria.

Next expert (iteration 242): **Engineer**
