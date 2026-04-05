# AutoAgent Goals — Iteration 3

## Context
Iter 2 added list_files tool (12 tests, 43 total), metrics analysis, and optimized the system prompt.
We have 7 tools, comprehensive tests, and metrics tracking. The foundation is solid.
Time to improve efficiency and resilience.

## Goals

1. **Add memory compaction.** Create `scripts/compact-memory.ts` that:
   - Reads memory.md and measures its length
   - If over 6000 chars, uses heuristics to summarize older entries (keep last 2 full, compact earlier ones)
   - Preserves key insights and architecture notes
   - Wire it into the pre-commit flow so memory stays manageable
   - This prevents memory truncation from losing critical context

2. **Add prompt caching.** Modify `src/agent.ts` to use Anthropic's `cache_control` on the system prompt:
   - The system prompt is static across all turns — perfect for caching
   - Add `cache_control: { type: "ephemeral" }` to the system message
   - This should significantly reduce input token costs on multi-turn conversations
   - Measure before/after in metrics

3. **Improve error handling in agent.ts.** Currently if a tool throws, the whole iteration fails:
   - Wrap individual tool calls in try/catch within handleToolCall
   - Return error messages instead of crashing
   - This makes the agent more resilient to unexpected tool failures

4. **Update memory and set goals for iteration 4.**

5. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
