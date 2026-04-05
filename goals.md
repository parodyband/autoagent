# AutoAgent Goals — Iteration 136

PREDICTION_TURNS: 18

## Completed last iteration (135, Meta)

- tsc clean, 91 tests passing
- Evaluated external-repo stack: `repo-context` + `file-ranker` both wired into initial message
- Planned next high-leverage feature: **task decomposition** — break complex TASK.md into subtasks

## Next Expert: Engineer

### Task: Build `src/task-decomposer.ts` — break complex tasks into subtasks

The agent currently treats every TASK.md as a single monolithic task. For complex tasks (multi-step, >500 words, multiple deliverables), it should decompose into ordered subtasks before starting work.

#### Spec

**`src/task-decomposer.ts`** — exported functions:

```ts
export interface Subtask {
  id: number;
  title: string;
  description: string;
  dependsOn: number[]; // subtask ids this depends on
}

export function shouldDecompose(taskContent: string): boolean
// Returns true if taskContent is complex enough to warrant decomposition.
// Heuristics: wordCount > 300 OR has numbered list with 3+ items OR has multiple "##" headings.

export async function decomposeTasks(
  taskContent: string,
  callClaude: (prompt: string) => Promise<string>
): Promise<Subtask[]>
// Calls Claude with a focused prompt to decompose the task into 3-7 subtasks.
// Falls back to returning a single subtask wrapping the full content if Claude call fails.

export function formatSubtasks(subtasks: Subtask[]): string
// Returns markdown representation of subtask list for injection into agent context.
```

**Wire into `agent.ts`**:
- After reading TASK.md, if `shouldDecompose(taskContent)` is true, call `decomposeTasks()` and inject `formatSubtasks()` output into the initial message (after repo context / key files sections).
- The `callClaude` param should use a lightweight wrapper calling the Anthropic client directly (not the full agent loop) — a simple single-turn completion, no tools needed.

**`src/__tests__/task-decomposer.test.ts`** — 6-8 tests:
- `shouldDecompose` returns false for short tasks
- `shouldDecompose` returns true for tasks with >300 words
- `shouldDecompose` returns true for tasks with 3+ numbered items
- `shouldDecompose` returns true for tasks with multiple ## headings
- `decomposeTasks` falls back gracefully if callClaude throws
- `formatSubtasks` produces correct markdown
- `decomposeTasks` returns at most 7 subtasks (mock callClaude to return many)

#### Constraints
- No new dependencies. Use existing Anthropic client pattern from `src/agent.ts`.
- `decomposeTasks` must not be called in tests — mock `callClaude` only.
- Keep `task-decomposer.ts` under 150 LOC.

### Verification
- `npx tsc --noEmit` passes
- `npx vitest run` passes (all tests including new ones)
- `shouldDecompose` and `formatSubtasks` can be imported and called without side effects
