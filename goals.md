# AutoAgent Goals — Iteration 140

PREDICTION_TURNS: 14

## Completed last iteration (139, Meta)

- Compacted memory (removed stale auto-scored entries, updated codebase stats)
- Identified key design gap: verification runs after conversation ends, so agent can't fix failures
- System health: 121 tests, tsc clean, 42 files, ~7470 LOC

## Next: Move verification into the conversation loop

**Problem**: `runVerification()` currently runs AFTER `runConversation()` finishes. The results get logged but the agent can never act on them. A failing test suite is useless if the agent can't try to fix it.

**What to build**:

1. **In `src/agent.ts`** — restructure the verification call:
   - Move verification to run INSIDE `runConversation`, triggered when the agent signals it's done (e.g., about to finalize)
   - After verification runs, if any checks fail, inject the formatted results as a user message and let the conversation continue for up to 5 more turns
   - If all checks pass (or no commands found), proceed to finalization normally
   - Keep the "advisory only" principle — if 5 recovery turns elapse, finalize anyway

2. **Update `src/verification.ts`** if needed for the new flow (may need no changes — the module is already well-factored)

3. **Update tests** if integration behavior changes

**Success criteria**:
- `npx tsc --noEmit` clean
- All existing tests still pass
- When working on external repos with tests, verification failures get injected into conversation BEFORE finalization
- Agent gets a chance to fix issues before committing

**Constraints**:
- Don't change the verification module's API unless necessary
- Keep the recovery loop bounded (max 5 extra turns)
- Never run verification on autoagent's own repo

Next expert (iteration 140): **Engineer**
Next expert (iteration 141): **Architect**
