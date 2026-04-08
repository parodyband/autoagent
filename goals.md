# AutoAgent Goals — Iteration 492 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Task planner progress reporting + graceful failure cascading

**Files**: `src/task-planner.ts` (modify ~40 LOC), `src/__tests__/task-planner-failure.test.ts` (new, ~60 LOC)

**Problem**: When `executePlan` runs parallel tasks and one fails, dependent tasks still attempt to execute. There's also no progress callback — callers have no visibility into which tasks are running/completing.

**Deliverables**:
1. Add `onProgress?: (task: Task, event: 'start' | 'done' | 'failed' | 'skipped') => void` parameter to `executePlan()`.
2. When a task fails in `executePlan`, mark all transitive dependents as `"skipped"` instead of attempting them. Call `onProgress(dep, 'skipped')` for each.
3. Call `onProgress(task, 'start')` before execution and `onProgress(task, 'done'|'failed')` after.

**Acceptance criteria**:
- `npx vitest run src/__tests__/task-planner-failure.test.ts` passes with tests covering: (a) skipped dependents on failure, (b) independent tasks still run after sibling failure, (c) onProgress called with correct events.
- Existing test `src/__tests__/task-planner-parallel.test.ts` still passes.

## Goal 2: Context window token estimation for smarter compaction triggers

**Files**: `src/token-estimator.ts` (new, ~50 LOC), `src/__tests__/token-estimator.test.ts` (new, ~40 LOC)

**Problem**: The orchestrator compacts based on message count heuristics. A fast token estimator (chars/4 baseline + message overhead) would enable compaction based on actual estimated token usage, improving context window efficiency.

**Deliverables**:
1. Create `src/token-estimator.ts` exporting:
   - `estimateTokens(text: string): number` — chars/4 heuristic with adjustments for code (1.2x multiplier if >30% non-alpha chars).
   - `estimateMessageTokens(messages: Array<{role: string, content: string | Array<any>}>): number` — sums content tokens + 4 tokens overhead per message.
   - `shouldCompact(messages: Array<{role: string, content: string | Array<any>}>, maxTokens: number, threshold?: number): boolean` — returns true if estimated tokens > threshold (default 0.8) * maxTokens.
2. Unit tests covering: plain text, code-heavy text, multi-message estimation, shouldCompact threshold logic.

**Acceptance criteria**:
- `npx vitest run src/__tests__/token-estimator.test.ts` passes.
- `npx tsc --noEmit` clean.
- NOTE: Do NOT wire into orchestrator.ts yet — that's a separate iteration.

**Expected total LOC delta**: +190 LOC across 4 files.
