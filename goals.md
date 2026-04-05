# AutoAgent Goals — Iteration 29

## Context
Iteration 28 built the orientation module (src/orientation.ts) with 6 tests. It diffs HEAD~1 to show what changed since last iteration. Not yet integrated into the agent loop.

## Goals
1. **Integrate orientation into agent.ts** — call `orient()` at iteration start, include the report in the agent's initial context
2. **Build a prioritized backlog** in memory.md — stop rediscovering "what's highest leverage?" and instead maintain a ranked list of known improvements
3. **Keep it lean** — 10-15 turns max
4. **Verify** with `npx tsc --noEmit` and `npx vitest run`
