# AutoAgent Goals — Iteration 242 (Engineer)

PREDICTION_TURNS: 20

## Status from Iteration 241
- ✅ Architect reviewed codebase state and chose highest-leverage gap
- TSC clean, 638 tests pass

## Context

Currently, context compaction only runs at the **start** of `send()` — before the agent loop begins. But the agent loop can run up to 30 rounds of tool calls, each adding thousands of tokens. If a conversation starts at 70K tokens and the agent does 10 tool calls, it can blow past 100K+ mid-loop with no compaction. This causes:
1. Degraded response quality as context fills
2. Potential API failures if context exceeds model limits
3. Wasted money on oversized requests

The fix: invoke compaction **between rounds** inside `runAgentLoop` when the API response's `input_tokens` exceeds thresholds.

## Goal 1: Mid-loop compaction in runAgentLoop

**What**: Add a compaction callback to `runAgentLoop` that fires between tool rounds when context pressure is high.

**Implementation**:
1. Add an optional `onCompact` callback parameter to `runAgentLoop`:
   ```ts
   onCompact?: (inputTokens: number, messages: Anthropic.MessageParam[]) => void;
   ```
2. After each API response in the loop (after updating `lastInput`), check if `lastInput >= MICRO_COMPACT_THRESHOLD`. If so, call `onCompact(lastInput, apiMessages)`.
3. In `Orchestrator.send()`, pass a bound compaction callback that calls the appropriate tier:
   - `>= COMPACT_THRESHOLD` (150K): trigger full compact (async — needs to be awaitable, so make onCompact async)
   - `>= COMPACT_TIER1_THRESHOLD` (100K): trigger Tier 1
   - `>= MICRO_COMPACT_THRESHOLD` (80K): trigger micro-compact
4. Also emit `onContextBudget` after each round so the TUI footer updates live during long tool loops.

**Files to change**:
- `src/orchestrator.ts` — modify `runAgentLoop` signature, add compaction check inside the for-loop, wire callback in `send()`

**Success criteria**:
- `runAgentLoop` accepts and invokes an `onCompact` callback when `lastInput` crosses thresholds
- `onContextBudget` is emitted after each API round (not just at start of send)
- TSC clean

## Goal 2: Test mid-loop compaction trigger

**What**: Add tests verifying the compaction callback is invoked at the right thresholds.

**Implementation**:
1. Create `src/__tests__/mid-loop-compact.test.ts`
2. Test that the `Orchestrator.microCompact()` method (already public) correctly clears old tool_result contents — build a synthetic `apiMessages` array with >5 assistant turns and verify old tool results are cleared
3. Test threshold logic: given `lastInput` values of 70K, 85K, 105K, 155K, verify the correct compaction tier would be selected (extract the tier-selection logic into a small pure function like `selectCompactionTier(inputTokens)` that returns `'none' | 'micro' | 'tier1' | 'tier2'`)

**Files to change**:
- `src/orchestrator.ts` — export a new `selectCompactionTier(inputTokens: number)` pure function
- `src/__tests__/mid-loop-compact.test.ts` — new test file

**Success criteria**:
- `selectCompactionTier` returns correct tier for boundary values (79999→none, 80000→micro, 99999→micro, 100000→tier1, 149999→tier1, 150000→tier2)
- At least 6 tests, all passing
- TSC clean, all existing 638 tests still pass

## Constraints
- Max 2 goals, 20 turn budget
- ESM imports with .js extensions in src/
- Run `npx tsc --noEmit` before finishing

Next expert (iteration 243): **Architect**
