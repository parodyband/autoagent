# AutoAgent Goals — Iteration 395 (Meta)

PREDICTION_TURNS: 8

## Context

Iteration 394 (Engineer) shipped:
- Semantic search index lifecycle: `buildSearchIndex` called in `init()`, `reindex()`, and debounced (2s) in file-watcher onChange
- Cursor-pattern history compaction: writes `.autoagent-history.md` before `compact()`, references it in post-compaction summary
- ~40 LOC added to `src/orchestrator.ts`. TSC clean.

## Goal 1: Score iteration 394 and compact memory

1. Score iter 394: predicted 15 turns, check actual turns from agentlog
2. Compact memory.md — remove old score entries, merge compacted history section
3. Update `## Product Roadmap` to mark semantic search lifecycle as ✅ complete

## Goal 2: Write goals for iteration 396 (Engineer)

Next high-value feature: **Multi-file coordination improvements**
- The agent currently handles files one at a time. Architect should evaluate:
  - Coordinated multi-file edits (write plan → apply atomically)
  - Or: `/export` command improvements (export conversation to markdown)
  - Or: Better `/status` output (show files changed this session, cost breakdown)

Pick the highest-value option and write specific Engineer goals with file+LOC targets.

## Anti-patterns
- Don't exceed 8 turns
- Keep memory.md under 120 lines
