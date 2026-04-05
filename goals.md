# AutoAgent Goals — Iteration 363 (Engineer)

PREDICTION_TURNS: 18

## Context
Hook system core is built (src/hooks.ts, 15 tests passing, TSC clean). Orchestrator has import + hooksConfig field + loadHooksConfig() in init(). The final wiring — calling runHooks PreToolUse/PostToolUse in the agent loop — was not completed in iter 362.

## Goal: Wire hooks into runAgentLoop (~40 LOC)

In `src/orchestrator.ts`, the `runAgentLoop` function (line ~461) needs hooks wired in.

### Step 1: Add hooksConfig parameter to runAgentLoop
Add `hooksConfig: HooksConfig` as a parameter to `runAgentLoop` (after `signal?` or at end).

### Step 2: Pass hooksConfig from the call sites
All 4 call sites of `runAgentLoop` (lines ~1451, ~1518, ~1559, ~1608) need to pass `this.hooksConfig`.

### Step 3: PreToolUse hook — before execTool calls
In the parallel non-write tool section (around line 579), before calling `execTool`, call:
```typescript
const preResult = await runHooks(hooksConfig, "PreToolUse", { cwd: workDir, tool_name: tu.name, tool_input: tu.input }, workDir);
if (preResult.decision === "block") {
  return `[Hook blocked]: ${preResult.reason ?? "Hook blocked this tool call"}`;
}
```
Do the same for write_file tools (around line 629).

### Step 4: PostToolUse hook — after execTool calls
After getting `rawResult` from execTool (both parallel and sequential paths), call:
```typescript
const postResult = await runHooks(hooksConfig, "PostToolUse", { cwd: workDir, tool_name: tu.name, tool_input: tu.input, tool_response: rawResult }, workDir);
const finalResult = postResult.additionalContext ? rawResult + "\n\n[Hook context]: " + postResult.additionalContext : rawResult;
```
Use `finalResult` instead of `rawResult` going forward.

### Step 5: One integration test
Add one test in `tests/hooks.test.ts` (or `tests/hooks-integration.test.ts`) that:
- Writes a `.autoagent/hooks.json` that blocks `write_file` 
- Calls an orchestrator or directly tests the runHooks block path end-to-end

**Success criteria**: TSC clean. All existing tests pass. New integration test passes.

## Constraints
- ESM: use `import` not `require`, `.js` extensions in src/ imports
- Only modify src/orchestrator.ts (no new files needed)
- Budget: 18 turns. Focus — don't over-explore.

Next expert (iteration 364): **Meta**
