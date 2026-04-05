# AutoAgent Goals — Iteration 342 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Loop/Stall Detection Circuit Breaker

Create `src/loop-detector.ts` that detects when the agent is stuck in a repetitive loop and breaks out with a helpful message.

### What to detect
1. **Repeated tool calls**: Same tool name + same arguments called 3+ times in the last 5 rounds
2. **Error loops**: Same error message appearing 3+ times consecutively
3. **Oscillation**: Agent alternating between two states (e.g., write file → error → write file → error)

### Interface
```typescript
export interface LoopDetectorResult {
  loopDetected: boolean;
  loopType: 'repeated-tool' | 'error-loop' | 'oscillation' | null;
  description: string; // Human-readable explanation
}

export function detectLoop(messages: Message[]): LoopDetectorResult;
```

### Integration
- Call `detectLoop()` inside the agent loop in `src/orchestrator.ts` after each round
- When a loop is detected, inject a system message: "⚠️ Loop detected: {description}. Try a different approach or ask the user for clarification."
- After 2 consecutive loop detections, stop the agent loop and return the loop description to the user
- Add a `maxConsecutiveLoops` option (default: 2) to Orchestrator config

### Tests
- `src/__tests__/loop-detector.test.ts` with at least 8 tests:
  - Detects repeated identical tool calls
  - Detects same error 3x
  - Detects oscillation pattern
  - Returns no loop for normal varied conversation
  - Returns no loop for legitimately similar but different tool calls (e.g., reading different files)
  - Integration: loop injection into message history
  - Edge case: empty messages
  - Edge case: messages with no tool calls

### Success criteria
- `npx vitest run src/__tests__/loop-detector.test.ts` — all pass
- `npx tsc --noEmit` — clean
- Loop detector is called in orchestrator agent loop

---

## Goal 2: Task Planning Foundation (`/plan` command)

Create `src/task-planner.ts` with types and logic for decomposing a user request into a structured task plan using the sub-agent tool.

### Types
```typescript
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'done' | 'failed';
  dependsOn: string[]; // Task IDs this depends on
}

export interface TaskPlan {
  goal: string;
  tasks: Task[];
  createdAt: number;
}

export function createPlan(userRequest: string, projectContext: string): Promise<TaskPlan>;
export function getNextTasks(plan: TaskPlan): Task[]; // Returns tasks whose deps are all 'done'
export function formatPlan(plan: TaskPlan): string; // Pretty-print for display
```

### Implementation
- `createPlan()` calls the Anthropic API (use haiku for cheapness) with a prompt that decomposes the request into 3-8 tasks with dependencies
- `getNextTasks()` returns all tasks whose `dependsOn` are all in `done` status
- `formatPlan()` renders a text-based task board showing status of each task
- Wire `/plan <description>` as a new slash command in `src/cli.ts` that calls `createPlan()` and displays the result

### Tests
- `src/__tests__/task-planner.test.ts` with at least 6 tests:
  - `getNextTasks` returns leaf nodes (no deps) first
  - `getNextTasks` respects dependency ordering
  - `getNextTasks` returns empty when blocked
  - `formatPlan` produces readable output
  - `createPlan` returns valid TaskPlan structure (mock the API)
  - Edge: single-task plan works

### Success criteria
- `npx vitest run src/__tests__/task-planner.test.ts` — all pass
- `npx tsc --noEmit` — clean
- `/plan` command works in CLI

---

## What NOT to do
- Don't refactor existing code
- Don't add features beyond what's specified above
- Don't spend turns on TUI changes (CLI only)
- Don't over-engineer — keep implementations simple and testable
