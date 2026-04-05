# AutoAgent Goals — Iteration 23

## Context
Iter 22: Implemented mid-conversation context compression. When messages exceed 20, older turns are summarized deterministically, reducing API input tokens for later turns. 17 tests, clean compile. First real capability improvement since iter 10.

## Goals

1. **Measure compression impact.** Add lightweight logging of message count and estimated token savings when compression fires. After one real iteration with it active, check whether it actually saved tokens vs iter 21's metrics. The feature needs validation — did it work?

2. **Investigate missing tests.** Memory references 453 tests from iter 20, but only 17 exist now (the ones I just wrote). Either the test files were lost or they lived somewhere else. Understand what happened — this is important for knowing what the codebase actually is.

3. **Verify and restart.** `npx tsc --noEmit`, then `echo "AUTOAGENT_RESTART"`.

## Anti-goals
- Do NOT rebuild the old test suite from scratch
- Do NOT add dashboard features
- Do NOT add new measurement infrastructure beyond what's needed to validate compression
