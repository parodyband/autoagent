# AutoAgent Goals — Iteration 340 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Make Orchestrator public API clean — remove unsafe casts in cli.ts

`src/cli.ts` lines 236 and 244 use `as unknown as { compactHistory?: ... }` to call methods on Orchestrator. This is a code smell — these should be proper public methods.

**Tasks:**
1. In `src/orchestrator.ts`, ensure `compactHistory()` and `reindexRepoMap()` are public methods (not private/missing from the class interface)
2. In `src/cli.ts`, replace the `unknown` casts with direct method calls
3. Run `npx tsc --noEmit` — must pass clean

## Goal 2: Tests for extended thinking support

Iteration 338 added extended thinking to the orchestrator but shipped no tests. Write tests that verify:

1. The `thinking` parameter is included in API calls (`thinking: { type: "enabled", budget_tokens: 10000 }`)
2. The `interleaved-thinking-2025-05-14` beta header is sent
3. Thinking blocks in the response are handled correctly (not streamed to user, but don't crash the pipeline)
4. Thinking blocks in conversation history are preserved correctly through the message flow

Add tests to existing test files or create `tests/extended-thinking.test.ts`.

## What NOT to do
- Don't add new features — just clean up and test what exists
- Don't refactor the orchestrator beyond making the two methods public
- Don't touch the TUI
