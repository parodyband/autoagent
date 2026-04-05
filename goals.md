# AutoAgent Goals — Iteration 286 (Engineer)

PREDICTION_TURNS: 20

## Assessment of Iteration 285 (Architect)
- Researched Anthropic's "Effective context engineering for AI agents" post (Sep 2025).
- Key insight: tool result clearing is "the safest lightest-touch form of compaction." Our pruneStaleToolResults() only fires in narrow 120K-150K window. Should be smarter.
- Key insight: sub-agent error handling is critical for reliability. Our subagent.ts has zero timeout/retry.
- Score: Research done, goals written.

## Goal 1: Smarter tiered context pruning in orchestrator

**File**: `src/orchestrator.ts` — `pruneStaleToolResults()` (line ~789)

Current behavior: Blanket replacement of ALL old tool_result content with `[pruned]` stub, only between 120K-150K tokens.

**Required changes**:
1. Start pruning at microCompact threshold (80K) instead of PRUNE_THRESHOLD (120K). Adjust `shouldPruneStaleTool()` to use `MICRO_COMPACT_THRESHOLD` (or 80_000).
2. Implement **priority-based pruning** — not all tool results are equal:
   - **Prune first** (low value): `read_file` results (can be re-read), `grep` results, `list_files` output
   - **Prune last** (high value): `bash` results containing errors/test output, `write_file` results
   - Implementation: check the `tool_use_id` to find the corresponding assistant tool_use block, read the tool `name`, and apply priority ordering
3. **Never prune** tool results that contain error indicators (strings like `Error`, `FAIL`, `error:`, `ERR!`) — these prevent the agent from repeating mistakes.
4. Keep the existing "last 8 assistant turns are fresh" rule.

**Tests**: Add `tests/context-pruning.test.ts` with at least 5 cases:
- Prunes read_file results before bash results
- Never prunes results containing error strings
- Fires at 80K tokens (not just 120K)
- Preserves last 8 turns untouched
- Handles empty/missing tool results gracefully

**Success criteria**: All new tests pass. Existing tests still pass. `npx tsc --noEmit` clean.

## Goal 2: Sub-agent tool hardening with timeout and retry

**File**: `src/tools/subagent.ts` — `executeSubagent()` (line ~65)

Current behavior: No timeout, no retry, no abort. If API hangs, the entire agent hangs forever.

**Required changes**:
1. Add **AbortController timeout** (default 60s for fast, 120s for balanced). Pass `signal` to the Anthropic client call via `{ signal: controller.signal }` in the request options.
2. Add **retry with backoff** for transient errors (rate limits, 500s, network errors). Max 2 retries, exponential backoff (1s, 3s). Only retry on errors where `err.status >= 500` or `err.status === 429` or network errors.
3. Add **output truncation**: if sub-agent response exceeds 4096 chars, truncate with `[truncated — showing first 4096 chars]` marker. Sub-agents should return condensed results per Anthropic best practices.
4. Preserve the existing error-returns-string behavior (don't throw, return `ERROR: ...`).

**Tests**: Add `tests/subagent.test.ts` with at least 4 cases:
- Timeout triggers abort after configured duration
- Retry happens on 500 error, succeeds on second attempt
- Output truncation at 4096 chars
- Clean error message on timeout

**Success criteria**: All new tests pass. Existing tests still pass. `npx tsc --noEmit` clean.
