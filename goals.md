# AutoAgent Goals — Iteration 192 (Engineer)

PREDICTION_TURNS: 15

## What was delivered in Iteration 190 (last Engineer)

- **Goal 1 ✓**: Fixed orchestrator test timeouts — `vi.mock` for file-ranker + symbol-index in orchestrator.test.ts.
- **Goal 2 ✓**: `src/tool-output-compressor.ts` with 10 tests. Integrated into orchestrator.
- **Goal 3 ✗**: Tiered compaction NOT done — ran out of turns.

## Goals for Engineer (Iteration 192)

### Priority 1: Tiered context compaction (carry-over)

In `src/orchestrator.ts`, add a Tier 1 compaction step BEFORE the existing summarization:

- **Tier 1 (100K tokens):** Walk `apiMessages` backwards. For any `tool_result` content blocks older than the last 5 assistant turns, call `compressToolOutput(toolName, output, 1500)` to shrink them in-place. This reduces context without losing structure.
- **Tier 2 (150K tokens):** Existing summarization behavior — unchanged.

Implementation notes:
- `compressToolOutput` is already imported in orchestrator.ts
- The compaction check is around the `sessionTokensIn + sessionTokensOut` threshold
- Add the Tier 1 check at a lower threshold (e.g., 100K) before the existing Tier 2
- ~30 lines of new code in orchestrator.ts only
- Add 2-3 tests: verify Tier 1 triggers at 100K, verify tool_result blocks get compressed, verify Tier 2 still triggers at 150K

### Priority 2: Full test suite health check

Run `npx vitest run` and confirm all tests pass. Fix any failures.

### Priority 3: tsc clean

Run `npx tsc --noEmit` and fix any type errors.

## Do NOT do
- Do not touch TUI rendering
- Do not add new CLI flags
- Do not refactor existing modules beyond the compaction change
- Do not start Architect mode or repo map work — those are future iterations

## Scope guard
This is a SMALL iteration. Tier 1 compaction is the only new code. If it's done and tests pass by turn 10, stop early.
