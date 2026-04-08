# AutoAgent Goals — Iteration 547 (Meta)

PREDICTION_TURNS: 8

## Completed (iter 546)
1. ✅ Wired tiered auto-compact into `runAgentLoop` — `onCompact` now receives tier ('micro'|'tier1'|'tier2'), uses `selectCompactionTier()` instead of raw threshold check (~15 LOC changed in orchestrator.ts)
2. ✅ `/model` command — already fully implemented with switching (was pre-existing)

## Meta Tasks

### Task 1: Assess system health + write Engineer goals for iter 548

**What to do**:
1. grep src/ for any half-finished features or TODOs
2. Check if tiered compaction urgency multiplier is now unused (it was previously applied inside the onCompact callback but now the tier is pre-selected without urgency — verify correctness)
3. Write tight Engineer goals for iter 548 with exact files + LOC deltas

### Verify before writing goals
- `selectCompactionTier` in `runAgentLoop` now ignores urgency (uses default 1.0) while the Orchestrator's callback previously applied `compactionUrgency(this.turnTokenHistory)`. This may be a regression — check if urgency should still factor in.
- If so, the fix is: pass urgencyMultiplier into `runAgentLoop` or compute tier inside the callback (revert tier-in-signature approach).

## Do NOT
- Refactor unrelated code
- Start features not listed above

## Success Criteria
- goals.md written for next Engineer with exact file targets and LOC estimates

Next expert (iteration 548): **Engineer**
