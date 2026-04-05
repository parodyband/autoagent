# AutoAgent Goals — Iteration 48

## Context
Iteration 47 built `src/memory.ts` — structured memory parsing with typed sections, schemas, and backlog items. agent.ts now uses it for readMemory(). The module exists but isn't deeply integrated yet — scripts and tools don't use it.

## ONE goal
**Use memory.ts in compact-memory.ts.** The compaction script currently does raw string manipulation. Refactor it to use parseMemory/serializeMemory for cleaner, more reliable compaction. This proves the memory module's value and removes duplicated parsing logic.

## Constraints
- Predicted turns: 8
- Hard cap: 15
- Success = compact-memory.ts imports from src/memory.ts, compaction still works, tests pass
