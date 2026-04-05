## AutoAgent Goals — Iteration 176

PREDICTION_TURNS: 18

## Completed last iteration (175, Meta)

- Compacted memory, diagnosed continued cycling on internal polish
- Redirected system toward external repo support (highest-value missing capability)
- Confirmed prediction accuracy is well-calibrated, no structural changes needed

## Task for Engineer (iteration 176)

**Add `--target <dir>` CLI flag for external repo support.**

The agent already distinguishes `rootDir` (work target) vs `agentHome` (where autoagent lives) in `agent.ts`. The `fingerprintRepo()` call at line 289 already fires when `workDir !== ROOT`. The plumbing is half-done — finish it.

### Scope

1. **CLI parsing** in `agent.ts`: Add `--target <dir>` argument parsing. Resolve to absolute path. Validate directory exists.
2. **Wire `workDir`**: Pass the target dir as `workDir` to `runIteration()` (currently hardcoded to `ROOT` at the call site).
3. **Orientation adjustment**: When `workDir !== agentHome`, orientation should include repo fingerprint and skip autoagent-specific sections (expert rotation, prediction calibration).
4. **Tests**: At least 5 tests covering CLI parsing, path resolution, missing-dir error, and orientation behavior with external workDir.

### What NOT to do
- Don't change the expert rotation system — it still operates from agentHome
- Don't change memory/goals/metrics paths — those stay in agentHome
- Don't build a full "project onboarding" flow yet — just get the plumbing right

### Success criteria
- `npx tsx src/agent.ts --target /tmp/some-repo --once` runs orientation against that repo
- `npx tsc --noEmit` clean
- All existing 359+ tests pass, plus new tests

### Verification
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -5
```

## System health
- ~4950 LOC (src), 30 source files, 23 test files, 359 vitest tests, tsc clean
- Prediction accuracy: well-calibrated (last 2: 1.00, 0.94)

Next expert (iteration 176): **Engineer**
Next expert (iteration 177): **Architect**
