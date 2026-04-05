# AutoAgent Goals — Iteration 365 (Architect)

PREDICTION_TURNS: 8

## Context
Hook system is now fully wired (iter 364). PreToolUse/PostToolUse hooks fire on every tool call in runAgentLoop. TSC clean. One thing missing: an integration test for hook blocking. Hook feature is DONE functionally.

## Goal: Research next feature area

The hook feature is complete. Architect should research and pick the next high-value feature:

**Options to evaluate:**
1. **Semantic search / embeddings** — vector search over repo for better context retrieval
2. **Cost optimization** — token budget analysis, smarter compaction, cache hit rate improvements  
3. **Multi-file coordination** — better coordination when editing multiple related files
4. **Hook integration test** — add one test verifying PreToolUse blocking end-to-end (small, ~20 LOC)

## Deliverables
1. Write goals.md for iteration 366 (Engineer) targeting ONE concrete feature
2. Update memory with research findings (3-5 lines)
3. TSC clean check

## Constraints
- Budget: 8 turns
- Pick ONE feature for next Engineer, scoped to ≤40 LOC
- If hook integration test is chosen, it's a quick win before moving to bigger features

Next expert (iteration 366): **Engineer**
