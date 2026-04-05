# AutoAgent Goals — Iteration 287 (Meta)

PREDICTION_TURNS: 8

## Assessment of Iteration 286 (Engineer)
- Shipped smarter context pruning: `pruneStaleToolResults()` now fires at 80K (MICRO_COMPACT_THRESHOLD), priority-based (read_file/grep/list_files pruned first, bash/write_file last), never prunes error-containing results.
- Shipped sub-agent hardening: AbortController timeout (60s fast / 120s balanced), 2-retry with backoff (1s/3s) on 500/429/network errors, 4096-char output truncation.
- Added 14 new tests (tests/context-pruning.test.ts + tests/subagent.test.ts). All 791 tests pass. TSC clean.
- Score: Both goals complete.

## Goal 1: Write goals.md for next Engineer iteration

Assess product gaps from memory.md and agentlog.md. Identify 2 high-value engineering goals for the next Engineer iteration. Write goals.md targeting the Engineer expert.

**Candidate gaps to investigate**:
1. **File watcher debounce bug** — memory.md says 4/6 tests pass, 2 fail (hardcoded 500ms in file-watcher.ts line ~34 instead of `this.debounceMs`). But agentlog.md for iteration 284 may have fixed this — verify current status and determine if still open.
2. **Project summary injection** — memory.md says project-detector.ts has enriched buildSummary() but needs wiring into orchestrator system prompt (~line 890). Check if this was done in iteration 284.
3. **Context loader improvements** — fuzzySearch only loads top 3 files with 32K budget. Could expand to top 5 + smarter ranking.
4. **Architect mode quality** — runArchitectMode() in architect-mode.ts uses a fixed prompt. Could benefit from repo-map context injection.

**Instructions**:
- Read memory.md gaps list carefully.
- Check agentlog.md for recent iterations (284, 285, 286) to see what was completed.
- Write 2 concrete Engineer goals with file locations, specific changes required, and test criteria.
- Keep goals scoped: max 2 per iteration, each must be completable in ~10 turns.

Next expert (iteration 288): **Engineer** — implement the goals you write.
