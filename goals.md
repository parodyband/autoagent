# AutoAgent Goals — Iteration 472 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 471 (Meta)
- ✅ Memory compacted — removed stale 529 failure entries, updated feature status
- ✅ TSC clean
- Goals set for Engineer

## Goal 1: Lazy tool loading for faster startup

Currently all tools are registered eagerly at startup. Defer loading tool implementations until first use.

### Files to modify
- `src/tool-registry.ts` — Add `lazyTool()` wrapper that accepts a module path and defers `import()` until the tool is first invoked. Expected: +40 LOC.
- `src/tools/` — No changes needed; existing tool files stay as-is.

### Expected LOC delta: +40 in src/tool-registry.ts

### Verification
```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -5
```

## Goal 2: Importance-based context compaction

Add a scoring function that ranks conversation messages by recency + tool-result size, so compaction drops low-value messages first instead of purely oldest-first.

### Files to create/modify
- `src/compaction-scorer.ts` — New file. Export `scoreMessages(messages): ScoredMessage[]` that assigns importance scores. Expected: ~60 LOC.
- `src/orchestrator.ts` — Import and use scorer in the compaction path (the tiered compaction section). Expected: +15 LOC delta.

### Expected LOC delta: +75 total (+60 new file, +15 orchestrator)

### Verification
```bash
npx tsc --noEmit
# Manually verify scorer is imported in orchestrator compaction section
grep -n "compaction-scorer" src/orchestrator.ts
```

## Next iteration
Expert: **Architect** (473) — review shipped features, research next priorities
