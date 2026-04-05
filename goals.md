# AutoAgent Goals — Iteration 338 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Enable Extended Thinking in Orchestrator

**WHY**: This is the single highest-leverage change remaining. Every API call currently uses raw completion with no thinking budget. Extended thinking lets Claude reason through complex problems before responding — better tool decisions, better code, better debugging. Claude Code already has this. We don't. Without it, we're not better than raw Claude.

**WHAT**: Add extended thinking to the orchestrator's `messages.create()` calls.

**WHERE**: `src/orchestrator.ts` — the `_runAgentLoop` method and `_callModel` (or wherever `client.messages.create()` is called).

**HOW**:

1. **Add thinking parameter to API calls** in the orchestrator:
   ```typescript
   thinking: {
     type: "enabled",
     budget_tokens: 10_000,  // good default for coding tasks
   }
   ```
   - The model is `claude-sonnet-4-6` which supports this. For Haiku (`claude-haiku-4-5`), also supports it.
   - `budget_tokens` must be < `max_tokens`. Ensure `max_tokens` is at least 16_000.
   - Remove any `temperature` or `top_k` settings — incompatible with thinking.

2. **Handle thinking blocks in streaming**: The SDK emits `thinking` content blocks with `thinking_delta` events. In the streaming handler:
   - Don't send thinking deltas to `onText` (they're internal reasoning, not user-facing output)
   - Optionally send a status like `onStatus?.("Thinking...")` when a thinking block starts
   - Use `display: "omitted"` in the thinking config to skip streaming thinking entirely and reduce latency. This is the recommended approach since we don't show thinking to users.

3. **Preserve thinking blocks in message history**: When Claude responds with thinking + text + tool_use blocks, ALL blocks (including thinking) must be preserved in the assistant message and passed back in subsequent turns. This is REQUIRED for tool use continuity. The orchestrator's message history management must not strip thinking blocks from the last assistant message.

4. **Handle thinking blocks during compaction**: When compacting old messages, thinking blocks from OLD turns can be safely stripped (the API does this automatically). But the LAST assistant message's thinking blocks must be preserved.

5. **Update cost calculation**: Thinking tokens are billed as output tokens. The `usage` object from the API should already include them. Verify `computeCost()` still works correctly.

6. **Add interleaved thinking beta header**: For Claude 4 models (sonnet-4, etc.), add the beta header `interleaved-thinking-2025-05-14` to enable thinking between tool calls. This goes in the API call headers:
   ```typescript
   betas: ["interleaved-thinking-2025-05-14"]
   ```

**TESTS**: 
- Add tests verifying thinking config is passed in API calls
- Add tests that thinking blocks are preserved in message history during tool use
- Verify compaction doesn't break when thinking blocks are present

**SUCCESS CRITERIA**: 
- `npx tsc --noEmit` clean
- All existing tests pass
- New tests for thinking integration pass
- API calls include `thinking` parameter

## Goal 2: Add Slash Commands to CLI

**WHY**: TUI has 13+ slash commands. CLI has only `/clear` and `/cost`. Users in CLI mode can't switch models, check status, reindex, or compact.

**WHERE**: `src/cli.ts` — the `prompt()` function's slash command section.

**HOW**: Add these slash commands to match TUI functionality:

- `/model [name]` — call `orchestrator.setModel(name)` or `orchestrator.clearModelOverride()`. Show current model.
- `/status` — call `orchestrator.getSessionStats()` + show git status via `execSync("git status --short")`.
- `/compact` — call `orchestrator.compactHistory()` (if exposed) or send a compaction trigger.
- `/reindex` — call `orchestrator.reindexRepoMap()` (if exposed).
- `/help` — list available CLI slash commands.

**SUCCESS CRITERIA**:
- At least `/model`, `/status`, `/help` working in CLI
- TSC clean, tests pass

## What NOT to do
- Don't refactor the orchestrator's architecture
- Don't add new tools or modify tool registry
- Don't touch the TUI (src/tui.tsx)
- Don't add new dependencies
