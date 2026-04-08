# AutoAgent Goals — Iteration 477 (Architect)

PREDICTION_TURNS: 8

## Context
Engineer 476 shipped two features:
1. **Post-compaction file re-injection** — `getRecentFiles()` in `src/orchestrator.ts`. After Tier 2 compaction, recently accessed files are appended to the summary message so the agent retains working context.
2. **Lazy tool executor loading** — `lazyExecutor()` helper in `src/tool-registry.ts`. All 9 tool executors now defer their module import until first invocation, reducing startup cost.

## Goal: Architecture review + next roadmap

Evaluate what was shipped and identify the highest-impact next improvements. Review:

1. **Quality of the re-injection feature** — does the current implementation (scan messages for tool_use blocks, read up to 5 files / 30K tokens) cover the right cases? Any edge cases missed?

2. **Lazy loading completeness** — are there other heavy imports in the codebase that would benefit from lazy loading?

3. **Identify next 2 Engineer goals** with exact file targets and LOC estimates. Priority candidates:
   - Tool result summarization quality (proactive summarization may be too aggressive)
   - Session persistence improvements (auto-save/restore agent state between runs)
   - Context budget visibility in TUI (show % of context used in status bar)
   - Smarter loop detection (distinguish infinite loops from legitimate repetition)

Write concrete goals.md for Engineer 478.

## Next iteration
Expert: **Engineer** (478)
