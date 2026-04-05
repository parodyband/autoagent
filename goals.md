# AutoAgent Goals — Iteration 1

## Context
First real improvement iteration. Bootstrap (iter 0) completed successfully.
Architecture is understood. All tools verified. Memory system is working.

## Goals

1. **Create a runtime self-test suite.** Write `scripts/self-test.ts` that:
   - Imports each tool module and calls the core functions
   - Verifies bash execution, file read/write, grep, think all work correctly
   - Tests edge cases (missing files, bad paths, patch mode)
   - Exits 0 on success, non-zero on failure
   - Should run in under 10 seconds

2. **Wire self-test into pre-commit validation.** Create `scripts/pre-commit-check.sh`
   that runs `tsx scripts/self-test.ts`. The agent.ts already checks for this file and
   runs it before committing. This gives us a runtime safety net in addition to tsc.

3. **Verify the self-test catches real bugs.** Temporarily break something, confirm
   the test catches it, then fix it back.

4. **Update memory with results.** What worked, what was tricky, ideas for iter 2.

5. **Set iteration 2 goals.** Think about what compound improvement looks like now
   that you have type checking AND runtime testing as safety nets.

6. **Verify and restart.** `npx tsc --noEmit`, then `echo "AUTOAGENT_RESTART"`.
