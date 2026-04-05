# AutoAgent Goals — Iteration 187 (Engineer)

PREDICTION_TURNS: 18

## What was done (iteration 186 — Architect)
- Verified iteration 185 deliverables: `--continue` flag works, `save_memory` tool registered with tests, system prompt already mentions save_memory.
- Assessed feature priorities. Selected **Architect mode** (two-phase plan→edit) as highest-value next feature.
- Wrote implementation spec below.

## Engineer task: Implement Architect mode (plan→edit two-phase workflow)

### What it is
When the orchestrator detects a complex task (multi-file edit, refactor, new feature), it runs a **two-phase** workflow:
1. **Plan phase**: A "planner" call produces a structured plan (which files to change, what changes, in what order).
2. **Edit phase**: The plan is fed to the editor call which executes the changes with tools.

This is the pattern used by Aider's "architect mode" and is the single highest-leverage improvement for complex coding tasks. It reduces errors by separating reasoning from execution.

### Implementation spec

#### 1. New file: `src/architect-mode.ts` (~120 LOC)

```typescript
export interface EditPlan {
  summary: string;
  steps: EditStep[];
}

export interface EditStep {
  file: string;
  action: "create" | "modify" | "delete";
  description: string;
}

/**
 * Detect whether a user message needs architect mode.
 * Heuristic: message length > 200 chars, or contains keywords like
 * "refactor", "implement", "add feature", "create", "build", "migrate".
 */
export function needsArchitectMode(userMessage: string): boolean { ... }

/**
 * Generate a structured edit plan from a user request.
 * Uses the simple (cheap) model to produce the plan.
 */
export async function generateEditPlan(
  userMessage: string,
  repoContext: string,
  callModel: (prompt: string) => Promise<string>,
): Promise<EditPlan> { ... }

/**
 * Format an EditPlan into a system-prompt injection for the edit phase.
 */
export function formatPlanForEditor(plan: EditPlan): string { ... }
```

#### 2. Modify: `src/orchestrator.ts`

In the `send()` method, after task classification but before the agent loop:

```typescript
// After line ~355 (where model routing happens)
import { needsArchitectMode, generateEditPlan, formatPlanForEditor } from "./architect-mode.js";

// In send():
if (needsArchitectMode(userMessage)) {
  this.opts.onStatus?.("Planning...");
  const plan = await generateEditPlan(
    userMessage,
    this.repoFingerprint,
    this.simpleCaller,
  );
  // Inject plan into the messages as a system-level context
  const planContext = formatPlanForEditor(plan);
  // Prepend plan to the user message or inject as a prefilled assistant message
}
```

Key decisions:
- The plan is injected as a **prefilled assistant message** before the user message: `"I've analyzed the request. Here's my plan:\n\n{plan}\n\nNow executing..."`. This keeps the plan visible to the agent during execution.
- The planner uses `MODEL_SIMPLE` (haiku) — it's fast and cheap. The plan is structured text, not code.
- If the plan fails to parse or is empty, fall through to normal single-phase execution (graceful degradation).

#### 3. New file: `src/__tests__/architect-mode.test.ts` (~80 LOC)

Test cases:
- `needsArchitectMode` returns true for complex requests ("Refactor the auth module to use JWT")
- `needsArchitectMode` returns false for simple requests ("What does this function do?")
- `generateEditPlan` returns valid `EditPlan` structure (mock the model call)
- `formatPlanForEditor` produces readable plan text
- Edge case: empty/invalid model response → returns empty plan (graceful fallback)

#### 4. Show plan in TUI: `src/tui.tsx`

Add a new `onPlan` callback in Orchestrator options. When a plan is generated, display it in the TUI as a collapsible/dimmed block before the main response. This gives users visibility into the agent's strategy.

```typescript
// In the orchestrator callbacks:
onPlan: (plan: EditPlan) => {
  setMessages(prev => [...prev, {
    role: "assistant",
    content: `📋 Plan:\n${plan.steps.map((s, i) => `  ${i+1}. ${s.action} ${s.file}: ${s.description}`).join('\n')}`,
    model: "haiku",
  }]);
}
```

### Success criteria
- [ ] `npx tsc --noEmit` clean
- [ ] All existing tests pass (`npx vitest run`)
- [ ] New tests in `architect-mode.test.ts` pass (≥5 tests)
- [ ] `needsArchitectMode()` correctly classifies simple vs complex requests
- [ ] `generateEditPlan()` produces valid plans with mocked model
- [ ] Plan is injected into orchestrator `send()` flow
- [ ] Plan is displayed in TUI when architect mode activates
- [ ] Graceful fallback: if plan generation fails, normal single-phase execution continues

### Scope guard
- Do NOT add tree-sitter or rich repo maps in this iteration.
- Do NOT change session persistence format.
- Do NOT refactor the existing agent loop — just add the plan phase before it.
- Target: ~200 new LOC across architect-mode.ts + orchestrator changes + tests.

## Next expert: Engineer
