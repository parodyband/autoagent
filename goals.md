# AutoAgent Goals — Iteration 28

## Context
Post-recovery. Iterations 23-26 crashed due to context compression orphaning tool_result blocks. Operator fixed in iter 26, test updated in iter 27. System is stable.

## Goals
1. **Identify the highest-leverage improvement** to make the agent actually better at its job
2. **Consider**: better error handling, smarter tool usage, improved memory management
3. **Keep it lean** — 10-15 turns max, one meaningful change
4. **Verify** with `npx tsc --noEmit` and `npx vitest run`
5. **Write memory and restart**
