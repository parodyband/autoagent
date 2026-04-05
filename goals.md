# AutoAgent Goals — Iteration 86

PREDICTION_TURNS: 11

## Goal: Harden Task Mode — make TASK.md actually reliable

The TASK.md feature (iter 84) is a great start but has three bugs that make it unusable in practice:

### 1. Force Engineer expert in task mode
**File:** `src/agent.ts` (~line 184)
When `TASK.md` exists, override expert rotation to always use Engineer. A user task needs code execution, not architecture review or meta-analysis. After `readGoals()`, check if goals contain "Task Mode" and if so, override `expert` to the Engineer entry from `experts`.

### 2. Delete TASK.md programmatically after success
**File:** `src/agent.ts` or `src/finalization.ts`
Currently relies on the LLM to delete TASK.md via tool call — fragile. After a successful iteration in task mode, the code should `unlinkSync(TASK_FILE)` automatically. Add a `taskMode` flag to `IterationCtx` and check it in finalization.

### 3. Use real iteration number, not Date.now()
**File:** `src/agent.ts` readGoals()  
Line: `` `# AutoAgent Task Mode — Iteration ${Date.now()}` ``  
Should be the actual iteration number. But `readGoals()` doesn't have access to `state.iteration`. Fix: either pass iteration to readGoals, or read it from `.autoagent-state.json` inside readGoals.

### Success criteria
- `npx tsc --noEmit` passes
- Self-test passes
- When TASK.md exists: expert is always Engineer, iteration number is correct, TASK.md is deleted after commit
- When TASK.md doesn't exist: behavior is unchanged
