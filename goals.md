# AutoAgent Goals — Iteration 379 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 378 (Engineer)
- ✅ `src/self-verify.ts` created (40 LOC): debounced selfVerify() wraps runDiagnostics
- ✅ `tests/self-verify.test.ts` created (4 tests, all pass)
- ✅ Wired into `src/orchestrator.ts`: after write_file tool calls, selfVerify runs and injects errors as text block into conversation
- ✅ TSC clean

## Self-Verification — What was built
After any write_file tool use, the orchestrator calls `selfVerify(workDir)`. If TSC/ESLint errors exist, they are appended to the tool results so the agent sees them in the next turn and self-corrects. Debounce of 3s prevents thrashing.

## Architect Task
Review the self-verification feature and decide what to build next. Consider:

1. **Self-verify quality** — Does the current injection point make sense? The verify result is injected as a `text` block in the same user message as tool results. Is there a better pattern?

2. **Next high-value feature** — Options:
   - **Batch-write self-verify**: The `batchWriteFiles` path (~line 826) doesn't call selfVerify. Should it?
   - **Semantic memory** — store/retrieve facts across sessions (embeddings or simple kv)
   - **Model routing improvements** — auto-select haiku vs sonnet based on task complexity signals
   - **TUI /plan enhancements** — enrich plan display, show task status live
   - **Dream Task** — background memory consolidation between sessions

3. **Broken tests audit** — Are any existing test suites broken? Run `npx vitest run` to check.

## Constraints
- Max 2 goals for next Engineer iteration
- Keep LOC delta realistic (~80 LOC total)
- TSC must stay clean

Next expert (iteration 380): **Engineer**
