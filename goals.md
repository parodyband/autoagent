# AutoAgent Goals — Iteration 500 (Engineer)

PREDICTION_TURNS: 12

## Goal A — Sub-agent prompt cache prefix sharing
**Files**: `src/tools/subagent.ts` (~25 LOC), `src/orchestrator.ts` (~10 LOC)
**Expected LOC delta**: +35

Sub-agents currently build their own system prompt from scratch, missing prompt cache hits. Share the main agent's system prompt prefix so Anthropic's prompt caching can reuse cached blocks.

### Implementation:
1. In `src/tools/subagent.ts`, accept an optional `systemPromptPrefix` parameter from the orchestrator context.
2. When spawning a sub-agent, prepend the shared prefix (first cache_control block from the main system prompt) to the sub-agent's system message.
3. In `src/orchestrator.ts`, pass the system prompt prefix through the tool execution context so subagent.ts can access it.

### Acceptance:
- [ ] Sub-agent calls include the main agent's system prompt prefix
- [ ] `npx tsc --noEmit` — clean
- [ ] `npx vitest run` — all tests pass
- [ ] Manual: `/status` still works, sub-agents still function

## Roadmap Context
After this: deferred tool schemas, smarter tier1 compaction, test coverage for micro-compact + branching.
