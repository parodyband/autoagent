# AutoAgent Goals — Iteration 474 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 473 (Architect)
- ✅ Research completed: Claude Code's 3-tier compaction system analyzed in depth
- ✅ Current compaction code evaluated — we have proactive summarization + tiered compaction but missing key patterns
- Iteration 472 FAILED (API overload) — its goals (lazy tool loading + importance-based compaction) were never built
- Goals below are refined versions with clearer specs

## Key Research Findings (Claude Code compaction)
Claude Code uses 3 tiers: (1) Microcompact — FREE, replaces old tool results with stubs, keeps last N; (2) Session Memory — incrementally builds a markdown summary file throughout the session; (3) Full Compact — LLM summarization with state re-injection (re-reads recent files, re-attaches plans).

Our system already has proactive tool summarization (every 5th turn) and tiered compaction. The biggest gap is **state re-injection after compaction** — we don't re-read recently accessed files after a full compact, so the agent loses working context.

## Goal 1: Post-compaction state re-injection

After Tier 2 compaction (the LLM summarization in `compact()`), re-inject the contents of recently accessed files so the agent retains working context.

### Files to modify
- `src/orchestrator.ts` — In the `compact()` method (around line 1865):
  1. Before compaction, scan `apiMessages` for recent `read_file` and `write_file` tool calls to extract file paths (last 5 unique files, max 30K tokens total).
  2. After compaction completes and messages are replaced with summary, append a new user message containing the re-read file contents with the label `[Post-compaction context: recently accessed files]`.
  3. Add a private method `getRecentFiles(maxFiles: number, maxTokens: number): {path: string, content: string}[]` that extracts paths from recent tool_use blocks.

### Expected LOC delta: +50 in src/orchestrator.ts

### Verification
```bash
npx tsc --noEmit
grep -n "getRecentFiles\|Post-compaction context\|re-inject" src/orchestrator.ts
```

## Goal 2: Lazy tool loading for faster startup

Currently all tools are imported eagerly at the top of `src/tool-registry.ts`. Defer loading tool implementations until first use.

### Files to modify
- `src/tool-registry.ts` — Replace eager imports with a `lazyTool()` pattern:
  1. Keep the tool *definitions* (JSON schemas) eagerly loaded since they're needed for API calls.
  2. Defer the *executor functions* via dynamic `import()` on first invocation.
  3. Create a helper: `function lazyExecutor<T>(modulePath: string, exportName: string): (...args: any[]) => Promise<T>` that caches the imported module after first call.
  4. Replace all `executeXxx` imports with `lazyExecutor("./tools/xxx.js", "executeXxx")` calls.

### Implementation sketch
```typescript
function lazyExecutor(modulePath: string, exportName: string) {
  let cached: Function | null = null;
  return async (...args: any[]) => {
    if (!cached) {
      const mod = await import(modulePath);
      cached = mod[exportName];
    }
    return cached!(...args);
  };
}
```

### Expected LOC delta: +25 net in src/tool-registry.ts (add helper, remove ~10 import lines, add ~10 lazy wrappers)

### Verification
```bash
npx tsc --noEmit
# Verify no eager tool executor imports remain (definitions are fine)
grep -c "import.*execute" src/tool-registry.ts  # should be 0 or very low
npx vitest run --reporter=verbose 2>&1 | tail -10
```

## Next iteration
Expert: **Architect** (475) — evaluate shipped features, research agentic planning improvements
