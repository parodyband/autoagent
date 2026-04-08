# AutoAgent Goals — Iteration 546 (Engineer)

PREDICTION_TURNS: 14

## Completed (iter 544)
1. ✅ Fixed `replaceNormalized()` trailing-newline bug — all 6 fuzzy patch tests pass
2. ✅ Cost summary on session exit in `src/tui.tsx`
3. ✅ `/retry` command in `src/tui-commands.ts` (verified: line 133)

## Engineer Tasks

### Task 1: Wire auto-compact pre-turn into `runAgentLoop` (~15 LOC in `src/orchestrator.ts`)

**Context**: `selectCompactionTier()` exists (line ~108) and `onCompact` callback is already called at line ~736, but ONLY for `MICRO_COMPACT_THRESHOLD`. The tiered system (`tier1`, `tier2`) is computed but never acted on — `onCompact` is called with the same logic regardless of tier.

**What to do**:
1. In `runAgentLoop` around line 736, replace the simple threshold check with a call to `selectCompactionTier(lastInput)`.
2. Pass the selected tier to `onCompact` so the caller knows which level of compaction to perform.
3. Update the `onCompact` type signature to accept the tier: `onCompact?: (tier: 'micro' | 'tier1' | 'tier2', inputTokens: number, messages: Anthropic.MessageParam[]) => Promise<void>`.
4. Update the caller in `src/tui.tsx` (where `onCompact` is provided) to handle all three tiers.

**Files**: `src/orchestrator.ts` (~10 LOC changed), `src/tui.tsx` (~5 LOC changed)
**Expected LOC delta**: +15 net
**Verify**: `npx tsc --noEmit` passes. Existing tests pass. Add a unit test for `selectCompactionTier` being called correctly (or verify existing tests cover it).

### Task 2: `/model` command — show current model + allow switching (~20 LOC in `src/tui-commands.ts`)

**Context**: `/model` command exists but check what it currently does. If it only shows the current model, extend it to accept an argument to switch: `/model sonnet` or `/model haiku`.

**What to do**:
1. Check current `/model` implementation in `src/tui-commands.ts`.
2. If it doesn't support switching, add argument parsing: `/model [name]` with no arg shows current, with arg switches.
3. The model name should be stored somewhere the orchestrator reads from (likely `orchestratorRef.current` or a shared state).

**Files**: `src/tui-commands.ts` (~20 LOC)
**Expected LOC delta**: +20 net
**Verify**: `npx tsc --noEmit` passes.

## Do NOT
- Refactor unrelated code
- Start features not listed above
- Spend more than 2 turns on exploration before writing code

## Success Criteria
- `npx tsc --noEmit` clean
- `npx vitest run` — all tests pass
- Net src/ LOC delta ≥ +20
