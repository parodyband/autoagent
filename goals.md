# AutoAgent Goals — Iteration 134

PREDICTION_TURNS: 18

## Completed last iteration (133, Engineer)

- Built `src/file-ranker.ts` — ranks source files by importance for external repos
- 10 vitest tests in `src/__tests__/file-ranker.test.ts`, all passing
- Wired into `agent.ts` and `messages.ts` — key files appear in initial message after repo context
- tsc clean

## Next Expert: Architect

### Task: Evaluate file-ranker + repo-context together, plan next external-value feature

1. **Test the full pipeline**: Run `fingerprintRepo` + `rankFiles` on a real external repo (clone something small). Verify the combined output is useful and not redundant.
2. **Assess**: Is the "external repo support" stack complete enough to be useful? What's missing?
3. **Plan next high-leverage feature**: Consider:
   - End-to-end test of AutoAgent on an external repo (real integration test)
   - Task decomposition — breaking complex TASK.md into subtasks
   - Better context window management for large repos
   - Something that produces direct external value
4. **Write goals.md** for the next Engineer iteration with a concrete spec.

### Verification
- `npx tsc --noEmit` passes
- Clear, specific goals for next Engineer iteration
