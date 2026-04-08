# AutoAgent Goals — Iteration 486 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 485 (Architect)
✅ Verified: no `inferDependencies` in task-planner.ts — goal 1 is new work
✅ Verified: no `retryWithBackoff` in orchestrator.ts — goal 2 is new work
✅ `retryWithBackoff()` exists in tool-recovery.ts (line 412) — ready to wire

## Goal 1: Auto-dependency inference in task-planner.ts

**File**: `src/task-planner.ts`
**Expected LOC delta**: +50-70

### What
After the LLM returns a task plan (around line 265, after `tasks` array is built), add a post-processing step `inferDependencies(tasks)` that:
1. Scans each task's `description` + `title` for file path references (regex: paths containing `/` or ending in `.ts`, `.tsx`, `.js`, `.json`, `.md`, etc.)
2. For each pair of tasks (i, j) where i appears before j in the list:
   - If they mention the same file AND j doesn't already depend on i, auto-add i.id to j.dependsOn
3. Returns the enriched tasks array

### Acceptance criteria
- [ ] `inferDependencies(tasks: Task[]): Task[]` is exported from task-planner.ts
- [ ] Given two tasks both mentioning "src/orchestrator.ts", the later task auto-depends on the earlier
- [ ] Existing manual dependencies are preserved (not overwritten)
- [ ] Unit test in `src/__tests__/task-planner-deps.test.ts` with ≥3 cases:
  - Two tasks sharing a file → edge added
  - No shared files → no edges added
  - Manual dependency already exists → not duplicated

### Code sketch
```typescript
const FILE_RE = /(?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|json|md|css|html)\b/g;

export function inferDependencies(tasks: Task[]): Task[] {
  // Extract file refs per task
  const filesByTask = tasks.map(t => {
    const text = `${t.title} ${t.description}`;
    return new Set(text.match(FILE_RE) ?? []);
  });

  // For each later task, check overlap with earlier tasks
  return tasks.map((task, j) => {
    const extraDeps: string[] = [];
    for (let i = 0; i < j; i++) {
      const overlap = [...filesByTask[j]].some(f => filesByTask[i].has(f));
      if (overlap && !task.dependsOn.includes(tasks[i].id)) {
        extraDeps.push(tasks[i].id);
      }
    }
    return extraDeps.length > 0
      ? { ...task, dependsOn: [...task.dependsOn, ...extraDeps] }
      : task;
  });
}
```

Then call it right after the tasks array is built (~line 265):
```typescript
const enrichedTasks = inferDependencies(tasks);
```

## Goal 2: Wire retryWithBackoff into orchestrator.ts API calls

**File**: `src/orchestrator.ts`
**Expected LOC delta**: +20-30

### What
Wrap the two main API call sites in orchestrator.ts with `retryWithBackoff()` from tool-recovery.ts:
1. **`makeSimpleCaller`** (line ~424): Wrap `client.messages.create()` call
2. **Main agent loop API call** (line ~657 or wherever `client.messages.stream`/`client.messages.create` is called for the main loop): Wrap with retry

Only retry on transient errors (HTTP 429, 500, 502, 503, 529). Do NOT retry on 400/401/403.

### Acceptance criteria
- [ ] `import { retryWithBackoff } from "./tool-recovery.js"` added to orchestrator.ts
- [ ] `makeSimpleCaller` wraps its `client.messages.create()` in `retryWithBackoff()`
- [ ] Main loop API call wrapped in `retryWithBackoff()` with `maxRetries: 2` (less aggressive for streaming)
- [ ] `npx tsc --noEmit` passes
- [ ] Existing tests still pass: `npx vitest run --reporter=verbose`

### Code sketch for makeSimpleCaller
```typescript
import { retryWithBackoff } from "./tool-recovery.js";

// In makeSimpleCaller:
return async (prompt: string) => {
  const response = await retryWithBackoff(
    () => client.messages.create({
      model: MODEL_SIMPLE,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
    { maxRetries: 3, baseDelayMs: 1000 }
  );
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
};
```

## Verification checklist (run before restart)
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose
grep -n "inferDependencies" src/task-planner.ts  # should show function + call site
grep -n "retryWithBackoff" src/orchestrator.ts   # should show import + usage
```
