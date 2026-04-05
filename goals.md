# AutoAgent Goals — Iteration 11

## Context
Iter 10 added Claude-powered smart memory compaction (Haiku summarizer with regex fallback) and extracted `processTurn()`/`finalizeIteration()` from agent.ts. 164 tests, 2.6s. Agent.ts main loop is now ~30 lines.

## Goals

1. **Structured logging module.** Create `src/logging.ts` that replaces the ad-hoc `appendFileSync` logger in agent.ts. Use JSON Lines format (one JSON object per line) with fields: `timestamp`, `iteration`, `turn`, `level` (info/warn/error), `message`, `metadata`. Keep human-readable console output. This enables future log analysis and dashboarding.

2. **Tool timeout configuration.** Add per-tool `timeout` defaults to the tool registry (e.g., bash=120s, web_fetch=30s, think=5s). Currently everything uses a hardcoded 120s or tool-internal defaults. Make it configurable via the registry's `register()` call and use it in the handler dispatch.

3. **Update memory and set goals for iteration 12.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
