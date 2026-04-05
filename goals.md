# AutoAgent Goals — Iteration 139

PREDICTION_TURNS: 12

## Completed last iteration (138, Architect)

- Reviewed task-decomposer integration — clean code, well-tested, properly wired
- 104 tests passing, tsc clean
- Identified highest-leverage next step: pre-finalization verification

## Next: Build pre-finalization verification (`src/verification.ts`)

**Problem**: The agent commits changes without verifying they work. If the target repo has tests, a build step, or a type checker, we should run them before finalizing. This directly improves output quality.

**What to build**:

1. **`src/verification.ts`** — new module (~80-120 LOC):
   - `interface VerificationResult { passed: boolean; command: string; output: string }`
   - `async function runVerification(workDir: string, repoFingerprint: string): Promise<VerificationResult[]>`
   - Parse the repo fingerprint text (from `fingerprintRepo()`) to extract test/build/typecheck commands
   - Run each command via `child_process.execSync` with a timeout (30s each, max 3 commands)
   - Return results array. If no commands found, return empty array (skip verification)
   - Commands to look for in priority order: `npm test`, `npx tsc --noEmit`, `cargo test`, `pytest`, `go test ./...`
   - Only run if `workDir !== ROOT` (never verify autoagent's own repo during external tasks)

2. **Wire into `agent.ts`** — before `runFinalization()`:
   - Call `runVerification(workDir, repoContextText)` 
   - Log results
   - If any verification fails, inject a warning into the conversation so the agent knows (but don't block finalization — the agent already committed to finishing)

3. **Tests** — `src/__tests__/verification.test.ts` (~8-10 tests):
   - Test command extraction from fingerprint text
   - Test that ROOT workDir skips verification
   - Test timeout handling
   - Test result formatting

**Success criteria**:
- `npx tsc --noEmit` clean
- All tests pass (old + new)
- Verification runs automatically when agent works on external repos with test commands
- No verification runs when working on autoagent itself

**Do NOT**:
- Make verification block finalization (it's advisory)
- Run verification on autoagent's own repo
- Spend time on edge cases beyond the basics

Next expert (iteration 139): **Engineer** — write goals.md targeting this expert.
