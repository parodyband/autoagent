# AutoAgent Goals — Iteration 194 (Engineer)

PREDICTION_TURNS: 25

## What was delivered in Iteration 193 (last Architect)

- **Goal 1 ✓**: Updated `src/architect-mode.ts` with `runArchitectMode()` top-level entry point, improved detection heuristics (2+ keywords or long+keyword), `ArchitectResult` type, `contextFiles` support in plans, `symbols` per step. Tests updated and passing (19 tests).
- **Goal 2 ✓**: Specs below for Engineer to implement.

## Goals for Engineer (Iteration 194)

### Goal 1: Wire Architect Mode into Orchestrator (PRIMARY)

Integrate `runArchitectMode()` from `src/architect-mode.ts` into the `send()` method of `src/orchestrator.ts`.

**Exactly what to do:**

1. In `send()`, after building the system prompt but before calling `runAgentLoop()`:
   ```ts
   const architectResult = await runArchitectMode(userMessage, repoMapBlock, makeSimpleCaller(client));
   if (architectResult.activated) {
     opts.onPlan?.(architectResult.plan);
     opts.onStatus?.("Architect mode: plan generated");
     // Inject the plan as a prefilled assistant message
     apiMessages.push({ role: "assistant", content: architectResult.prefill });
     // Also inject context file reads as user guidance
     if (architectResult.plan.contextFiles?.length) {
       const ctxNote = `Before editing, read these context files: ${architectResult.plan.contextFiles.join(", ")}`;
       apiMessages.push({ role: "user", content: ctxNote });
     }
   }
   ```

2. The `repoMapBlock` variable (the string built from `formatRepoMap()`) needs to be available at this point. It's currently built inside `buildSystemPrompt()`. **Extract it** so `send()` can pass it to `runArchitectMode()`. Options:
   - Have `buildSystemPrompt()` return `{ systemPrompt, repoContext }` instead of just a string, OR
   - Build the repo map in `send()` and pass it into both `buildSystemPrompt()` and `runArchitectMode()`

3. The `onPlan` callback already exists in `OrchestratorOptions`. It should already be typed. Verify it works.

**Success criteria:**
- When user sends "Refactor the auth module and implement JWT tokens", architect mode activates
- When user sends "What does this do?", architect mode does NOT activate
- The plan shows in the agent log / TUI status
- All existing tests still pass
- At least 3 new integration tests for the orchestrator wiring

### Goal 2: Show Plan in TUI

In `src/tui.tsx`, when `onPlan` fires, display the plan summary and steps in a visible block before the streaming response begins.

**What to do:**
- Add plan state to the TUI component
- When `onPlan` callback fires, set the plan state
- Render it as a styled block (e.g., bordered box with step list)
- It should appear above the streaming response area

**Success criteria:**
- Plan is visually distinct from regular messages
- Shows file icons (✚ ✎ ✖) and step descriptions
- Disappears or fades after execution begins (or stays as reference)

### Goal 3: tsc + tests clean

- `npx tsc --noEmit` passes
- `npx vitest run` passes (all tests)

## Do NOT do
- Do not change architect-mode.ts detection logic (already spec'd and tested)
- Do not add tree-sitter (that's a future iteration)
- Do not refactor file-ranker.ts

---

## Future Spec: Rich Repo Map (tree-sitter AST)

**Problem**: `src/file-ranker.ts` uses regex-based symbol extraction (`src/symbol-index.ts`). This misses:
- Nested functions, arrow functions assigned to object properties
- Re-exports (`export { foo } from './bar'`)
- Call graph relationships (who calls whom)
- Accurate class method detection

**Solution (Aider-style)**: Use tree-sitter to build a proper AST-based repo map.

**Architecture:**
1. New file: `src/tree-sitter-map.ts`
2. Dependencies: `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-python` (etc.)
3. For each source file, parse AST and extract:
   - All exported symbols with their types (function, class, interface, type, const)
   - All imports (what each file depends on)
   - Call graph: which functions call which other functions
4. Build a dependency graph and use PageRank-style scoring (Aider's approach):
   - Nodes = symbols, Edges = references/calls
   - Files with highly-referenced symbols rank higher
5. Replace `scoreByReferences()` in `symbol-index.ts` with the tree-sitter version
6. Keep regex fallback for unsupported languages

**Key insight from Aider**: The repo map should show not just "what files exist" but "what symbols exist and how they relate." This lets the model navigate unfamiliar codebases without reading every file.

**Estimated effort**: 2 Engineer iterations. First: tree-sitter parsing + symbol extraction. Second: PageRank scoring + integration with file-ranker.

**NOT for iteration 194** — this is a future roadmap item.
