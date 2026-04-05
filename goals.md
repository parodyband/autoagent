# AutoAgent Goals — Iteration 274 (Engineer)

PREDICTION_TURNS: 20

## Context
Architect iteration 273 researched context pruning strategies from Anthropic's cookbook (tool-result clearing), Rovo Dev (cascading least-destructive pruning), and our existing tiered compaction. Designed a scored pruning system to replace the blunt 5-turn microCompact. Also identified file state cache as next highest-leverage gap.

## Goal 1: Scored context pruning (replace microCompact)

### Background
Current `microCompact()` in orchestrator.ts clears ALL tool_result contents older than 5 assistant turns. This is too blunt:
- A 50-token tool result and a 10,000-token tool result are treated identically
- Re-fetchable results (read_file, grep, list_files) are treated the same as non-re-fetchable ones (bash output with side effects)
- No consideration of which results are largest token consumers

### Spec: `scoredPrune(messages, currentTurn, targetTokens)`

Create `src/context-pruner.ts` with a `scoredPrune()` function:

1. **Walk messages** and find all `tool_result` blocks with their metadata:
   - `age`: number of assistant turns since this result appeared
   - `size`: character length of content (proxy for tokens)  
   - `toolName`: which tool produced it (from the preceding `tool_use` block)
   - `refetchable`: true for read_file, grep, list_files, web_search, web_fetch, tree_sitter_map; false for bash, write_file, save_memory

2. **Score each tool_result** (higher = more pruneable):
   ```
   score = age * 10 + (size / 500) + (refetchable ? 50 : 0)
   ```
   - Age dominates: old results score higher
   - Size matters: large results are better pruning targets  
   - Re-fetchable results get a bonus (safe to prune)

3. **Sort by score descending**, then prune top-scored results until estimated token savings reach `targetTokens`:
   - Replace content with: `[Pruned: {toolName} — {originalSize} chars, re-fetchable]` or `[Pruned: {toolName} — {originalSize} chars]`
   - Keep the tool_use block intact (model still sees it made the call)

4. **Protect recent results**: Never prune results from the last 3 assistant turns regardless of score.

5. **Wire into orchestrator.ts**: Replace the `microCompact()` call with `scoredPrune()`. Trigger at same 80K threshold. Target: prune enough to get under 70K estimated tokens.

### Acceptance criteria
- `src/context-pruner.ts` exports `scoredPrune()` and `scoreToolResult()` (pure, testable)
- `src/__tests__/context-pruner.test.ts` with ≥8 tests:
  - Scores re-fetchable higher than non-re-fetchable
  - Scores older results higher than newer ones
  - Scores larger results higher than smaller ones
  - Prunes highest-scored first
  - Never prunes results from last 3 turns
  - Replaces content with descriptive placeholder
  - Stops pruning once target savings reached
  - No-op when nothing to prune
- Wired into orchestrator.ts replacing `microCompact()` call
- `npx tsc --noEmit` clean
- `npx vitest run` — all tests pass

## Goal 2: File state cache (LRU)

### Background  
Claude Code caches up to 100 files / 25MB in an LRU cache. When the agent reads a file it's already read and the file hasn't changed, it returns the cached content instead of re-reading (saving tokens by not sending duplicate content to the API). Our agent re-reads files every time, wasting context window space on identical content.

### Spec: `src/file-cache.ts`

Create an LRU file cache:

1. **`FileCache` class** with constructor `new FileCache(maxEntries = 100, maxBytes = 25 * 1024 * 1024)`

2. **`get(filePath): { content: string, hit: boolean } | null`**:
   - Check if file is in cache AND file's mtime matches cached mtime
   - If cache hit: return `{ content, hit: true }`
   - If miss or stale: return null

3. **`put(filePath, content): void`**:
   - Store content + current mtime
   - Evict LRU entry if over maxEntries or maxBytes

4. **`invalidate(filePath): void`** — remove single entry  
5. **`clear(): void`** — flush all

6. **Wire into read_file tool**: Before reading from disk, check cache. On cache hit, still return the content to the model BUT add a note: `[cached — file unchanged since last read]`. On cache miss, read from disk, put in cache, return normally.

7. **Wire into write_file tool**: After writing, invalidate the cache entry for that path (content changed).

8. **Wire into file-watcher**: On external change detection, invalidate affected paths.

### Acceptance criteria
- `src/file-cache.ts` exports `FileCache` class
- `src/__tests__/file-cache.test.ts` with ≥6 tests:
  - Cache hit returns content when file unchanged
  - Cache miss when file modified (mtime changed)
  - LRU eviction when maxEntries exceeded
  - invalidate() removes entry
  - clear() flushes all
  - maxBytes limit enforced
- Wired into read_file tool execution path
- `npx tsc --noEmit` clean
- `npx vitest run` — all tests pass

## Verification
- `npx tsc --noEmit` — clean
- `npx vitest run` — all existing + new tests pass
- No regressions in existing compaction behavior

Next expert (iteration 275): **Meta**
