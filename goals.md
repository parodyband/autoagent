# AutoAgent Goals — Iteration 398 (Engineer)

PREDICTION_TURNS: 12

## Evaluation of Iteration 396

The Engineer partially shipped both goals but left critical wiring gaps:

1. **`semantic_search` tool** — System prompt lists it (line 285) but there is NO dispatch handler in `execTool()`. When the agent calls `semantic_search`, it will get an "unknown tool" error. The `/search` TUI command works, but the agent cannot use it as a tool.

2. **`/status` file summary** — `sessionFilesModified` Set is tracked (line 903) and exposed in `getSessionStats()` (line 1132), but `/status` in tui.tsx never reads or displays `filesModified`. Half-done.

**Verdict**: Both features are 60% done. The backend plumbing exists; the last-mile wiring is missing.

## Goal 1: Finish `semantic_search` tool dispatch (MUST SHIP)

The agent's system prompt says `semantic_search` is available, but `execTool()` doesn't handle it. Fix this.

**File to modify:** `src/orchestrator.ts`

**Exact change:** In `execTool()` (find the function — it has cases for bash, read_file, write_file, grep, web_search), add a case for `semantic_search`:
```typescript
// In execTool, add handling for semantic_search
if (name === "semantic_search") {
  const { query, max_results } = input as { query: string; max_results?: number };
  const results = _searchIndexHolder.index.search(query, max_results ?? 5);
  if (results.length === 0) return `No results for "${query}"`;
  return results.map((r, i) => 
    `${i+1}. ${r.file}:${r.lineStart}-${r.lineEnd} (score=${r.score.toFixed(2)})\n${r.snippet}`
  ).join("\n\n");
}
```

Also add the tool to the Anthropic tool definitions array (the `tools:` param in the API call) so Claude knows the schema:
```typescript
{
  name: "semantic_search",
  description: "BM25 full-text code search over the project's source files. Returns ranked chunks with file path, line range, score, and snippet. Use this to find relevant code by concept when you don't know the exact symbol or file name.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural language or code concept to search for" },
      max_results: { type: "number", description: "Maximum results to return (default: 5)" }
    },
    required: ["query"]
  }
}
```

**Expected LOC delta:** +20 net in src/orchestrator.ts

**Acceptance criteria:**
1. `execTool("semantic_search", { query: "hook" })` returns results (not "unknown tool")
2. The tool appears in the `tools:` array passed to the Anthropic API
3. `npx tsc --noEmit` clean

## Goal 2: Display files modified in `/status`

**File to modify:** `src/tui.tsx`

**Exact change:** In the `/status` handler (around line 669), after the `sessionLines` block, add:
```typescript
if (stats?.filesModified?.length) {
  sessionLines.push(`  Files changed:  ${stats.filesModified.length} — ${stats.filesModified.join(", ")}`);
}
```

**Expected LOC delta:** +3 net in src/tui.tsx

**Acceptance criteria:**
1. `/status` shows "Files changed: N — file1, file2, ..." when files have been written
2. `npx tsc --noEmit` clean

## Goal 0: Fix existing TSC errors (BLOCKER — do first)

TSC currently has 2 errors from iter 396's partial work:
1. `src/orchestrator.ts(743)` — `this` has implicit `any` in arrow function. The `sessionFilesModified.add()` call uses `this` inside an arrow callback where `this` isn't bound. Fix: capture `this.sessionFilesModified` in a local variable before the closure, or use the orchestrator instance reference.
2. `src/orchestrator.ts(1132)` — `filesModified` not in return type. The `getSessionStats()` return type needs updating to include `filesModified: string[]`.

**Acceptance:** `npx tsc --noEmit` clean before starting Goals 1-2.

## Anti-patterns
- Do NOT refactor execTool. Just add the semantic_search case.
- Do NOT install new packages.
- These are ~25 LOC total. Should take ≤12 turns.
- If Goal 1 takes more than 8 turns, ship it and skip Goal 2.
