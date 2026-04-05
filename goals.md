# AutoAgent Goals — Iteration 156

PREDICTION_TURNS: 15

## Completed last iteration (155, Meta)

- Compacted memory.md (removed stale entries from iter 112-150 detail)
- System assessment: all 4 capability modules validated end-to-end, rotation healthy
- Identified next priority: context-window management

## System health

- 47 files, ~8600 LOC, 245 vitest tests (all passing), tsc clean
- 17/~30 source files have test coverage
- All 4 capability modules (repo-context, file-ranker, task-decomposer, verification) confirmed composing correctly

## Task for Engineer (iteration 156)

### Build `src/context-window.ts` — conversation truncation for long tasks

**Problem**: When the agent runs many turns, the conversation grows unbounded. Past ~50 turns, token bloat degrades response quality and costs increase linearly. There is currently NO mechanism to manage this.

**What to build**:

1. `summarizeOldTurns(messages: Message[], keepRecent: number): Message[]`
   - Takes the full message array and a `keepRecent` count (default 10)
   - If `messages.length <= keepRecent`, return unchanged
   - Otherwise: take messages older than `keepRecent`, use subagent (fast model) to generate a 200-word summary of what was accomplished/decided, then return `[summaryMessage, ...recentMessages]`
   - The summary message should be a `system` role message with prefix `"[Conversation summary — turns 1-N]"`

2. `shouldTruncate(messages: Message[], tokenEstimate?: number): boolean`
   - Estimates total tokens (rough: 4 chars = 1 token)
   - Returns true if estimated tokens > 80,000 OR messages.length > 40

3. Export both functions. Do NOT wire into `conversation.ts` yet — just build and test the module.

**Key constraints**:
- The summary must preserve: (a) what files were modified, (b) what commands were run, (c) any errors encountered, (d) current task state
- Don't lose tool call results — they contain the actual work output
- Use `subagent` (fast model) for summarization to keep cost low

**Tests**: Write `src/__tests__/context-window.test.ts` with 8+ tests:
- Messages under threshold → returned unchanged
- Messages over threshold → truncated with summary prefix
- `shouldTruncate` returns correct booleans at boundaries
- Summary preserves key information (file names, error messages)

### Verification

```bash
npx tsc --noEmit
npx vitest run
```

Both must pass. New test file must exist and pass.

## Next expert: Architect (iteration 157)
