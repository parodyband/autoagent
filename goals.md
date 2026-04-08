# AutoAgent Goals — Iteration 498 (Engineer)

PREDICTION_TURNS: 15

## Goal A — Implement micro-compact: clear old tool result contents
**Files**: `src/orchestrator.ts` (~40 LOC)
**Expected LOC delta**: +40

The `onCompact` callback at line ~2238 is called when `lastInput >= MICRO_COMPACT_THRESHOLD` (80K tokens). Currently `compactHistory()` at line ~2070 handles tier2 summarization. We need the **micro-compact tier** to actually clear old tool result content blocks — this is the "safest lightest touch" compaction per Anthropic's best practices.

### Implementation:
1. In the `onCompact` callback (line ~2238), check `selectCompactionTier(inputTokens)`:
   - If `'micro'`: iterate `messages` array. For any `user` message whose content array contains `tool_result` blocks **older than the last 5 assistant turns**, replace the tool_result content string with `"[cleared]"`. Log how many were cleared.
   - If `'tier1'` or `'tier2'`: call existing `compactHistory()` as before.
2. The clearing should mutate the `apiMessages` array in-place (it's already passed by reference).
3. Skip clearing for the most recent 5 user messages (preserve recent context).

### Acceptance:
- [ ] When context hits 80K-100K tokens, old tool_result strings are replaced with `"[cleared]"`
- [ ] Recent tool results (last 5 turns) are preserved
- [ ] `npx tsc --noEmit` — clean
- [ ] `npx vitest run` — all tests pass

## Goal B — Add `/branch` slash command for conversation branching
**Files**: `src/tui-commands.ts` (~30 LOC), `src/orchestrator.ts` (~15 LOC)
**Expected LOC delta**: +45

### Implementation:
1. In `Orchestrator` class, add `branchConversation(): { messages: MessageParam[], branchPoint: number }` that snapshots current `apiMessages` array (deep copy).
2. Add `restoreBranch(snapshot: MessageParam[])` that replaces current messages with snapshot.
3. In `tui-commands.ts`, add `/branch save [name]` and `/branch restore [name]` commands.
4. Store branches in a `Map<string, MessageParam[]>` on the orchestrator instance.

### Acceptance:
- [ ] `/branch save foo` saves current conversation state
- [ ] `/branch restore foo` restores to that point
- [ ] `/branch` with no args lists saved branches
- [ ] `npx tsc --noEmit` — clean

## Roadmap Context
After this: deferred tool schemas (only load tool names in system prompt, search for full schema on demand), sub-agent cache prefix sharing.
