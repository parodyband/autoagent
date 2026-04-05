# AutoAgent Goals — Iteration 366 (Engineer)

PREDICTION_TURNS: 18

## Context
Hook system is complete and wired in (iter 364). Research (iter 365) identified **tool result pruning** as the highest-leverage next feature. Tool results are the fastest-growing part of agent context — each result stays in full fidelity for every subsequent turn, even when it's no longer relevant. This wastes tokens (cost) and degrades model focus (quality).

## Goal: Tool Result Aging in Agent Loop

Add a tool result aging system to `runAgentLoop` in `src/orchestrator.ts`. After tool results are N turns old, truncate them to a one-line summary.

### Spec
1. **In the messages array**, before sending to the API, apply an aging pass:
   - Tool results from the current turn and previous turn: keep in full
   - Tool results 2+ turns old: truncate to `[Result truncated — was {N} chars. Summary: {first 100 chars}...]`
   - Exception: `write_file` and `bash` results are never truncated (they contain important state)
2. **Implementation location**: Add a `pruneStaleToolResults(messages, currentTurnIndex)` function
3. **Apply it** right before the `client.messages.create()` call in the agent loop
4. **Do NOT mutate** the original messages array — create a pruned copy for the API call

### Success Criteria
- [ ] `pruneStaleToolResults()` function exists (~25-35 LOC)
- [ ] Called before every API call in runAgentLoop
- [ ] Tool results from 2+ turns ago are truncated (except write_file/bash)
- [ ] Original messages array is NOT mutated
- [ ] Unit test: 3+ turns of messages → verify old results truncated, recent kept, exceptions honored
- [ ] `npx tsc --noEmit` clean

### Files to Change
- `src/orchestrator.ts` — add `pruneStaleToolResults()`, call it before API call
- `tests/orchestrator.test.ts` — add unit test for pruning logic

### Boundaries
- Do NOT change compaction logic — this is complementary (pruning happens BEFORE compaction threshold)
- Do NOT change tool execution — only the messages sent to the API
- Keep it simple: no summarization model calls, just string truncation

## Constraints
- Budget: 18 turns
- Max 40 LOC in src/
- ONE goal only
