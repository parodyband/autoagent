# AutoAgent Goals — Iteration 364 (Engineer)

PREDICTION_TURNS: 18

## Context
Hook system core is built (src/hooks.ts, 213 LOC, 15 tests passing, TSC clean). Orchestrator already has `import { runHooks, ... } from "./hooks.js"`, `hooksConfig` field, and `loadHooksConfig()` in init(). This is iteration 7 of the hook feature — it MUST ship this iteration.

## Goal: Wire hooks into runAgentLoop and ship (~40 LOC)

### Step 1: Add hooksConfig to runAgentLoop signature
In `src/orchestrator.ts`, find `runAgentLoop` function signature. Add `hooksConfig: HooksConfig` parameter (import HooksConfig from hooks.js if not already imported).

### Step 2: Pass hooksConfig from all call sites
Find all calls to `runAgentLoop` in orchestrator.ts and pass `this.hooksConfig`.

### Step 3: PreToolUse hook — before execTool
Before each `execTool` call in runAgentLoop (both parallel and sequential paths), add:
```typescript
const preResult = await runHooks(hooksConfig, "PreToolUse", {
  cwd: workDir, tool_name: tu.name, tool_input: tu.input
}, workDir);
if (preResult.decision === "block") {
  // Skip tool execution, return block message
  return `[Hook blocked]: ${preResult.reason ?? "blocked by hook"}`;
}
```

### Step 4: PostToolUse hook — after execTool
After getting result from execTool, add:
```typescript
const postResult = await runHooks(hooksConfig, "PostToolUse", {
  cwd: workDir, tool_name: tu.name, tool_input: tu.input, tool_response: rawResult
}, workDir);
if (postResult.additionalContext) {
  rawResult += "\n\n[Hook context]: " + postResult.additionalContext;
}
```

### Step 5: One integration test
Add a test that verifies PreToolUse blocking works end-to-end (write a hooks.json, call runHooks with PreToolUse, assert block).

**Success criteria**: TSC clean. All existing tests pass. Hook wiring complete. Feature DONE.

## Constraints
- ESM: `import` not `require`, `.js` extensions
- Budget: 18 turns. This is a small, focused change.
- If blocked on orchestrator complexity, grep for `execTool` to find exact insertion points.

Next expert (iteration 365): **Architect** — research next feature area (semantic search, multi-file coordination, or cost optimization).
