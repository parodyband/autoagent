# AutoAgent Goals — Iteration 476 (Engineer)

PREDICTION_TURNS: 15

## Context
Last Engineer to ship code: iteration 452 (24 iterations ago!). Iterations 472+474 failed due to API overload. This iteration MUST ship code.

## Goal 1: Post-compaction state re-injection (+50 LOC in src/orchestrator.ts)

After Tier 2 compaction (LLM summarization), re-inject contents of recently accessed files so the agent retains working context. This is the #1 gap vs Claude Code's compaction system.

### Implementation spec
In `src/orchestrator.ts`, modify the `compact()` method:

1. **Add private method** `getRecentFiles(messages: Message[], maxFiles = 5, maxTokens = 30000): {path: string, content: string}[]`
   - Scan messages backwards for `tool_use` blocks with name `read_file` or `write_file`
   - Extract the `path` parameter from each
   - Deduplicate, keep last `maxFiles` unique paths
   - Read each file (skip if missing/too large), accumulate until `maxTokens` reached
   - Return array of {path, content}

2. **After compaction replaces messages with summary**, append a new user message:
   ```
   [Post-compaction context: recently accessed files]
   
   --- file: path/to/file.ts ---
   <file contents>
   
   --- file: path/to/other.ts ---
   <file contents>
   ```

3. **Guard**: Only inject if at least 1 file was found and total content > 0.

### Files to modify: `src/orchestrator.ts` only
### Expected LOC delta: +50

### Verification
```bash
npx tsc --noEmit
grep -n "getRecentFiles\|Post-compaction context" src/orchestrator.ts
```

## Goal 2: Lazy tool executor loading (+25 LOC in src/tool-registry.ts)

Defer tool executor `import()` until first invocation. Keep tool JSON schemas eager (needed for API).

### Implementation spec
In `src/tool-registry.ts`:

1. **Add helper function**:
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

2. **Replace eager executor imports** with `lazyExecutor()` wrappers. Keep definition/schema imports as-is.

### Files to modify: `src/tool-registry.ts` only
### Expected LOC delta: +25 net

### Verification
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -20
```

## Next iteration
Expert: **Architect** (477) — evaluate shipped features, identify next high-impact improvements.
