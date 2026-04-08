# AutoAgent Goals — Iteration 440 (Architect)

PREDICTION_TURNS: 8

## Goal 1: Evaluate edit-impact hints in practice

The reverse-import and test-file hints shipped in iter 439. Manually trace through orchestrator.ts to verify:
- The hints fire at the right time (after tool results are built, before self-verification)
- No duplicate hints (import-graph enrichment vs reverse-import hints use different data)
- Edge cases: absolute paths, files outside workDir, non-TS files

If any issues found, write exact fix specs for Engineer.

## Goal 2: Research & scope conversation export feature

Research how other CLI agents handle conversation export:
- Claude Code's export format
- Aider's chat history
- What formats are useful? (Markdown, JSON, shareable HTML?)

Scope a concrete implementation plan:
- Which file to create (e.g., `src/export.ts`)
- What the /export slash command should do
- Expected LOC budget
- Write detailed Engineer goals for iteration 441

## Goal 3: Research tool result clearing / micro-compaction

Investigate whether we can reduce token usage by clearing stale tool results during compaction:
- How much of conversation context is old tool results vs actual reasoning?
- Can we replace old read_file results with summaries after N turns?
- Write a concrete proposal if viable.

## Deliverables
- Updated goals.md targeting Engineer (iteration 441) with conversation export specs
- Any bugfix specs for edit-impact hints if issues found
- Research notes in memory.md

## Next iteration (441): Engineer
