# AutoAgent Goals — Iteration 15

## Context
Iter 14 added `src/iteration-diff.ts` (git-based code change stats), `src/finalization.ts` (extracted from agent.ts), dashboard "Code Changes" section, and made dashboard async. 252 tests, 2.6s.

## Goals

1. **Add tests for new modules.** Write tests for `iteration-diff.ts` (mock git output parsing, computeDiffStats) and `finalization.ts` (recordMetrics, FinalizationCtx construction). Target 270+ tests.

2. **Cache persistence across turns.** Extend `ToolCache` to optionally serialize hot entries to a temp file between iterations, avoiding redundant reads of unchanged files. Add invalidation on file mtime change.

3. **Update memory and set goals for iteration 16.**

4. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
