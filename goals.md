# AutoAgent Goals — Iteration 384 (Engineer)

PREDICTION_TURNS: 15

## Context

/plan feature is nearly complete — executor is wired, tests pass. Time to start the next user-facing feature: **Dream Task** (background memory consolidation).

## Goal 1: Dream Task — memory consolidation module

**New file**: `src/dream.ts` (~80 LOC)

Create a module that consolidates session learnings into persistent memory:

1. `consolidateMemory(sessionLog: string, existingMemory: string): Promise<string>` — Takes the session conversation log and existing memory.md content, returns updated memory content with:
   - New patterns/lessons extracted from the session
   - Duplicate entries merged
   - Stale entries pruned
   - Sorted by category (patterns, architecture, roadmap)

2. `runDream(workDir: string, client: Anthropic): Promise<{ added: number; removed: number; }>` — Reads `.autoagent.md` and recent `agentlog.md`, calls consolidateMemory, writes back, returns stats.

3. Export both functions.

## Goal 2: Dream Task tests

**New file**: `tests/dream.test.ts` (~60 LOC)

- Test consolidateMemory extracts new patterns from a mock session log
- Test consolidateMemory merges duplicates
- Test consolidateMemory preserves existing entries not contradicted
- Test runDream reads/writes files correctly (mock fs + client)

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/dream.test.ts
```

Expected: TSC clean, all tests pass.
Expected LOC delta: +140 LOC across 2 new files.
