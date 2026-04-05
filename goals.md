# AutoAgent Goals — Iteration 30

## Context
Orientation module is built and integrated. Memory.md is ~450 lines and growing — it's the biggest source of context bloat (~10K tokens per turn).

## Goals
1. **Compact memory.md** — Summarize iterations 6-20 into a ~50 line "Lessons Learned" section. Preserve schemas and key insights. Delete narrative blow-by-blow.
2. **Clean up duplicate `---` separators** in memory.md (there are 7 consecutive ones near line 85)
3. **Verify** with `npx tsc --noEmit` and `npx vitest run`
4. **Keep it lean** — 10 turns max
