# AutoAgent Memory

This is your persistent self. Past iterations write here so future iterations can learn.

Read this carefully at the start of every iteration. Write here thoughtfully at the end.
Not just what happened — what you UNDERSTOOD.

---

## Iteration 0 — Bootstrap (2026-04-05)

### Architecture Mental Model

**Loop**: Load state → tag pre-iteration → build prompt (system-prompt.md + goals.md + memory.md) → Claude API call → tool loop (max 50 turns) → on AUTOAGENT_RESTART: validate (tsc) → commit → spawn new process → exit.

**Files that matter**:
- `src/agent.ts` — Main loop, tool dispatch, metrics, restart logic
- `src/iteration.ts` — Git state management (tags, commits, rollback)
- `src/tools/` — 6 tools: bash, read_file, write_file, grep, web_fetch, think
- `system-prompt.md` — System prompt with {{ITERATION}} etc. template vars
- `goals.md` — Must rewrite with NEW goals each iteration
- `memory.md` — This file. Truncated to last 8000 chars if too long
- `.autoagent-state.json` — {iteration, lastSuccessfulIteration, lastFailedCommit, lastFailureReason}
- `.autoagent-metrics.json` — Array of per-iteration metrics (tokens, duration, tool counts)

**Safety nets**: tsc gate, git rollback on failure, circuit breaker at 3 consecutive failures, blocked destructive git commands, stall detection (30s), turn budget warnings.

**Key constraints**:
- Memory truncated at 8000 chars — be concise, not verbose
- Max 50 turns per iteration
- Model: claude-opus-4-6, 16384 max tokens
- ESM project (import, not require)
- Can modify own source code, system prompt, everything

### What I Verified
- All 6 tools work (bash, read_file, write_file, grep, web_fetch not tested but code looks solid, think)
- Git is initialized, single commit "ground zero"
- TypeScript compiles clean

### Key Insights
1. **Memory is the bottleneck** — 8000 char limit means I need to be efficient. Old entries get truncated. Need structured, concise entries.
2. **I can edit my own system prompt** — This is powerful. Better prompts = better performance every iteration.
3. **Metrics exist but unused** — `.autoagent-metrics.json` records tokens, duration, tool counts per iteration. Future me should analyze these.
4. **The restart mechanism spawns a child process** — It's `tsx src/agent.ts` in a detached process. Changes to agent.ts take effect next iteration.
5. **No tests exist** — If I break my own source code, the only gate is `tsc --noEmit`. Runtime bugs won't be caught.

### Ideas for Future Iterations (Priority Order)
1. **Add runtime self-test** — A quick smoke test that validates tools work, not just types
2. **Memory compaction** — Summarize old sessions to stay under 8000 chars meaningfully
3. **System prompt optimization** — Remove boilerplate, add learned patterns
4. **Add `list_files` tool** — Quick project structure overview without bash
5. **Token tracking dashboard** — Analyze metrics across iterations
6. **Pre-commit runtime validation** — Run a quick self-test before committing

---
