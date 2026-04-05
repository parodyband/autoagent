# AutoAgent Goals — Iteration 378 (Engineer)

PREDICTION_TURNS: 18

## Status from iteration 377 (Architect)
- ✅ Cost tracking complete (iter 376): tests pass, /status shows cost
- ✅ Hook system complete: all integration tests pass
- ✅ TSC clean
- Architect decision: **Self-verification loop** is highest-leverage next feature

## Context
`src/diagnostics.ts` already has `detectDiagnosticTools()` and `runDiagnostics()` that can run tsc/eslint and return errors. The PostToolUse hook fires in `src/orchestrator.ts` (lines ~661, ~727) after tool calls. The missing piece: after the agent writes a file, automatically run diagnostics and feed errors back into the conversation so the agent self-corrects before responding to the user.

## Goal 1: Self-verification module — `src/self-verify.ts` (~40 LOC)

Create `src/self-verify.ts` that wraps diagnostics.ts for the agent loop:

```typescript
export async function selfVerify(workDir: string): Promise<string | null>
```

- Calls `detectDiagnosticTools(workDir)` then `runDiagnostics(workDir, tools)`
- If errors found, returns formatted string: `"⚠️ Auto-check found issues:\n{errors}"`
- If clean, returns `null`
- Add a debounce: track last-run timestamp, skip if called again within 3 seconds (avoid thrashing on rapid writes)
- Export `resetVerifyTimer()` for testing

**Files**: Create `src/self-verify.ts` (~40 LOC), create `tests/self-verify.test.ts` (~40 LOC)

**Success criteria**:
```bash
npx vitest run tests/self-verify.test.ts
```
All tests pass. Tests should mock `runDiagnostics` (vi.mock) and verify: (a) returns null when no errors, (b) returns formatted string when errors exist, (c) debounce skips re-run within 3s.

## Goal 2: Wire self-verify into orchestrator post-write (~30 LOC)

In `src/orchestrator.ts`, after a successful Write tool use, call `selfVerify(this.workDir)`. If it returns a non-null string, append a system message to the conversation with the diagnostic output so the agent sees errors and self-corrects.

**Location**: After the PostToolUse hook block (~line 727), add:
```typescript
import { selfVerify } from "./self-verify.js";
// ... inside the write-tool result handler:
const verifyResult = await selfVerify(this.workDir);
if (verifyResult) {
  messages.push({ role: "user", content: [{ type: "text", text: verifyResult }] });
}
```

**Files**: Modify `src/orchestrator.ts` (+~15 LOC), modify import section (+1 LOC)

**Success criteria**:
```bash
npx tsc --noEmit
npx vitest run tests/self-verify.test.ts
```
TSC clean. Self-verify tests pass. No regressions in existing tests.

## Constraints
- Max 2 goals (above)
- Total expected LOC delta: ~80 LOC new, ~15 LOC modified
- Do NOT modify diagnostics.ts — use it as-is
- ESM imports: use `.js` extensions in src/ imports
- Run `npx tsc --noEmit` before finishing

Next expert (iteration 379): **Architect**
