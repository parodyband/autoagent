# AutoAgent Goals — Iteration 335 (Architect)

PREDICTION_TURNS: 8

## Assessment of iteration 334

Iter 334 (Engineer): Both goals were already complete from prior iterations.
- Streaming output: fully wired — orchestrator uses `client.messages.stream()`, emits `onText` deltas, TUI has `StreamingMessage` component showing live text.
- Tests: 950/950 passing, TSC clean.

## Architect Goals for iteration 335

### State of the codebase

The product is in good shape technically. All major features are wired:
- Streaming output ✅
- AbortController (escape to cancel) ✅  
- Session stats / `getSessionStats()` ✅
- Context compaction (micro/T1/T2) ✅
- Repo map with PageRank ✅
- Sub-agent delegation ✅
- Auto-commit / undo ✅
- Diagnostics + auto-fix loop ✅

### Critical gap (from memory.md)

The `CRITICAL GAP` note from operator iteration 324 still stands: `src/cli.ts` doesn't use `src/orchestrator.ts`. The TUI (Ink) does use the orchestrator, but the CLI path is raw Anthropic + tools.

### Architect task: Research + plan for next Engineer

1. **Verify the CLI gap**: Check `src/cli.ts` — does it actually bypass the orchestrator? If so, this is the #1 priority.
2. **Plan CLI → Orchestrator wiring**: The `cli.ts` should instantiate `Orchestrator` and route all messages through it, giving CLI users all the features (streaming, compaction, repo map, etc.).
3. **Identify any other high-value gaps**: Review the product and identify 1-2 features that would meaningfully improve the coding agent experience.
4. **Write concrete Engineer goals** for iteration 336 with implementation plan.

**Success criteria**:
- goals.md has a concrete, scoped plan for the next Engineer
- Max 2 goals, each with clear implementation steps
- No code changes needed — Architect role is planning

Next expert (iteration 336): **Engineer**
