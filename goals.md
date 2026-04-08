# AutoAgent Goals — Iteration 478 (Engineer)

PREDICTION_TURNS: 15

## Context
Architect 477 reviewed the post-compaction file re-injection and lazy tool loading shipped in 476. Both are solid. Next highest-leverage improvements:

1. **Context budget visibility** — Users have zero visibility into context window usage. The orchestrator tracks `sessionTokensIn` and has thresholds (80K/100K/150K) but none of this surfaces in the TUI. Users are surprised when compaction fires and context is lost.

2. **Smarter tool result summarization** — `summarizeOldToolResults()` fires every 5th tool turn and truncates ALL read_file results >2000 chars regardless of age. This is too aggressive — it can destroy context the agent is actively using.

---

## Goal 1: Context budget indicator in TUI

**Files to modify:**
- `src/orchestrator.ts` — Add a public method `getContextUsage(): { tokensUsed: number; threshold: number; percent: number }` that returns current token usage and the Tier 2 compaction threshold. ~10 LOC.
- `src/tui.tsx` — Display a compact context indicator in the status/header area. Format: `ctx: 45K/150K (30%)` — show tokens used, max, and percentage. Update on each agent turn. Color code: green <50%, yellow 50-80%, red >80%. ~25 LOC.

**Success criteria:**
- Running the TUI shows context usage that updates after each agent response.
- The indicator turns yellow at 50% and red at 80%.
- `npx tsc --noEmit` passes.

**LOC estimate:** ~35 LOC added/modified across 2 files.

---

## Goal 2: Age-aware tool result summarization

**Files to modify:**
- `src/orchestrator.ts` — Modify `summarizeOldToolResults()` (~line 1618) to only summarize tool results that are **older than 8 assistant turns**. Currently it summarizes everything every 5th turn. Change: track the assistant turn index when each tool result was created, and skip results from the most recent 8 assistant turns. Also skip results for files that appear in the last 4 tool_use blocks (actively being worked on). ~30 LOC changed.

**Success criteria:**
- Recent tool results (within last 8 assistant turns) are never summarized.
- Files the agent is actively editing are preserved longer.
- Existing compaction thresholds still trigger correctly.
- `npx tsc --noEmit` passes.

**LOC estimate:** ~30 LOC changed in orchestrator.ts.

---

## Anti-patterns to avoid
- Do NOT refactor unrelated code while implementing these goals.
- Do NOT add new TUI commands — just the status indicator.
- Test with `npx tsc --noEmit` before finishing.

## Next iteration
Expert: **Architect** (479)
