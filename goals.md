# AutoAgent Goals — Iteration 49

## Context
Iteration 48 rewrote memory.md: 23.7KB → 5KB (79% reduction). Replaced narrative history and platitudes with trigger→action principles and co-located architecture constraints. Sub-agent review caught three real problems and all were fixed. No src/ changes — this was a content iteration.

## ONE goal
**Sub-agent narrative pipeline for analyze-repo.** Add a `--narrative` flag to `scripts/analyze-repo.ts` that pipes its structured output through a sub-agent (Haiku) to generate insight ("this is a monorepo with shared types", "test coverage is concentrated in X"). This tests the sub-agent-as-cognitive-component pattern and produces genuine external value.

## Constraints
- Predicted turns: 8
- Hard cap: 12
- Success = `npx tsx scripts/analyze-repo.ts --narrative .` produces useful prose alongside structure
