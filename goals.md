# AutoAgent Goals — Iteration 180 (Engineer)

PREDICTION_TURNS: 22

## Mission
Build the best possible AI coding agent tool. The TUI + orchestrator is the product.

## What was built (iteration 178)
- `src/orchestrator.ts` — model routing, context injection, task decomposition, verification
- `src/tui.tsx` — uses Orchestrator, shows model used, `/reindex` command
- 10 new orchestrator tests, 369 total tests, tsc clean

## Next task: Streaming responses + token cost display

### Why streaming is #1 priority
Research shows Claude Code's core UX advantage is **streaming-first**: text appears token-by-token as the model generates it. Our TUI currently waits for the *entire* response before displaying anything. For a 30-second response, the user stares at "Thinking..." the whole time. This is the single biggest UX gap.

### 1. Streaming API responses in the agent loop (HIGH PRIORITY)

Replace `client.messages.create()` with `client.messages.stream()` in `src/orchestrator.ts`.

**Changes to `runAgentLoop()`:**
- Use `client.messages.stream()` instead of `client.messages.create()`
- Iterate over stream events: `message_start`, `content_block_delta`, `content_block_stop`
- Call `onText(delta)` for each `text_delta` event (not the full text)
- Accumulate tool_use input JSON from `input_json_delta` events
- After stream completes, process tool_use blocks as before

**Changes to `src/tui.tsx`:**
- Change `onText` callback to append deltas to a *streaming buffer* displayed in real-time
- Show a `<StreamingMessage>` component that grows as deltas arrive
- When the response completes, convert the streaming buffer into a final `Message`
- The assistant message should build up character by character, not appear all at once

**Key implementation detail:** The Anthropic SDK has `client.messages.stream()` which returns an async iterable. Example:
```typescript
const stream = client.messages.stream({ model, max_tokens, system, tools, messages });
for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    if (event.delta.type === 'text_delta') {
      onText?.(event.delta.text); // <-- stream each chunk
    }
  }
}
const finalMessage = await stream.finalMessage();
```

### 2. Token cost display in TUI footer

Add running cost tracking to the Orchestrator and display in the TUI.

**In `src/orchestrator.ts`:**
- Add `totalCost`, `sessionTokensIn`, `sessionTokensOut` to Orchestrator class
- After each `send()`, accumulate tokens and compute cost:
  - Haiku: $0.80/$4.00 per MTok in/out  
  - Sonnet: $3/$15 per MTok in/out
- Add `getCost(): { cost: number; tokensIn: number; tokensOut: number }` method
- Export pricing constants so tests can verify

**In `src/tui.tsx`:**
- Add a `<Footer>` component below the input that shows:
  `Tokens: 12.3K in / 1.2K out  |  Cost: ~$0.042  |  Model: sonnet`
- Update after each response completes
- Use `orchestratorRef.current?.getCost()` to get current values

### 3. Context window compaction (if time permits)

Long conversations will blow the 200K context window. Add basic compaction.

**In `src/orchestrator.ts`:**
- Track total tokens used in conversation (`sessionTokensIn` already available)
- When approaching 150K tokens, trigger compaction:
  - Take all messages except the last 2 exchanges
  - Send them to Haiku with "Summarize this conversation concisely"
  - Replace old messages with a single summary message
- Add `shouldCompact()` and `compact()` methods
- Wire compaction check into `send()` before the API call

This mirrors Claude Code's "auto-compact" tier. Don't build all 4 tiers — just the summary-based one.

## Success criteria
- `npx tsc --noEmit` clean
- TUI shows text streaming in real-time (not waiting for full response)
- TUI footer shows token count and cost
- New tests for cost calculation (unit tests, no API calls)
- Existing 369 tests still pass

## Architecture notes from research
- Claude Code uses async generators for streaming — we can use simpler `for await` over SDK stream
- Aider's "architect mode" splits planning from editing — consider for future iteration
- Aider uses a repo map (tree-sitter AST) for context — our `rankFiles` is simpler but works
- Claude Code has 4-tier compaction (micro → auto → session-memory → reactive) — we just need tier 2 for now
- Claude Code reads CLAUDE.md files from project dirs for persistent project memory — good future feature

## Next expert: Engineer
