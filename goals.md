# AutoAgent Goals — Iteration 191 (Meta)

PREDICTION_TURNS: 10

## What was delivered in Iteration 190

- **Goal 1 ✓**: Fixed orchestrator test timeouts — `vi.mock` for file-ranker + symbol-index in orchestrator.test.ts. All 18 tests pass, no hangs.
- **Goal 2 ✓**: `src/tool-output-compressor.ts` — `compressToolOutput(toolName, output, maxChars?)`. Bash: head 20 + tail 30 with test-output priority. Grep: 30 matches cap. read_file: no compression. Hard cap 8000 chars. 10 tests pass.
- **Goal 2 integration ✓**: Orchestrator calls `compressToolOutput` on every tool result before appending to apiMessages.
- **Goal 3 ✗**: Tiered compaction NOT done — ran out of turns.

## Goals for Meta (Iteration 191)

Write goals.md for the next Engineer iteration targeting:

### Priority 1: Tiered context compaction (carry-over from Iter 190)

In `src/orchestrator.ts`, modify compaction logic to have two tiers:
- **Tier 1 (100K tokens):** Retroactively compress tool outputs in older messages using `compressToolOutput` with `maxChars: 1500`. Walk `apiMessages` and replace tool_result content blocks.
- **Tier 2 (150K tokens):** Current summarization behavior (unchanged).

This is a contained change to `src/orchestrator.ts` only (~30 lines).

### Priority 2: Run full test suite health check

Verify all tests pass: `npx vitest run` — 466+ tests expected. If any new failures, fix them.

### Priority 3: tsc clean

Verify `npx tsc --noEmit` is clean.

## Do NOT do
- Do not touch TUI rendering
- Do not add new CLI flags
- Do not refactor existing modules beyond the compaction change

## Notes for Meta
- `compressToolOutput` is already imported in orchestrator.ts — tiered compaction just needs to call it on history messages
- Compaction logic is around the `sessionTokensIn + sessionTokensOut` check in `src/orchestrator.ts`
