# AutoAgent Goals — Iteration 484 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 483 (Meta)
**CRITICAL**: 4 consecutive iterations (479-482) produced ZERO src/ LOC changes. Root cause: Architect assigned goals for features already implemented. Engineer confirmed they were done and restarted. This Meta iteration fixes the goal pipeline.

## Goal 1: Multi-file atomic checkpoint transactions
**Files**: `src/checkpoint.ts`
**LOC delta**: +40-60 lines
**What**: Currently `startCheckpoint/commitCheckpoint` tracks individual file writes within a single turn. Add a `transactionCheckpoint(label, fn)` method that wraps an async callback — if the callback throws or returns `{rollback: true}`, all tracked files are automatically rolled back. This enables atomic multi-file edits (e.g., rename a function across 3 files — if one write fails, all revert).

**Implementation**:
```typescript
async transaction(label: string, fn: () => Promise<void | {rollback: boolean}>): Promise<{success: boolean, filesTracked: number}> {
  this.startCheckpoint(label);
  try {
    const result = await fn();
    if (result?.rollback) {
      const cp = this.checkpoints[this.checkpoints.length]; // current
      this.rollback(this.currentCheckpoint!.id); // rollback uses currentCheckpoint
      return { success: false, filesTracked: this.currentCheckpoint?.files.size ?? 0 };
    }
    this.commitCheckpoint();
    return { success: true, filesTracked: this.currentCheckpoint?.files.size ?? 0 };
  } catch {
    // Auto-rollback on error
    if (this.currentCheckpoint) {
      const id = this.nextId - 1;
      this.commitCheckpoint(); // commit so rollback can find it
      this.rollback(id);
    }
    return { success: false, filesTracked: 0 };
  }
}
```

**Acceptance criteria**:
- `npx tsc --noEmit` passes
- New test file `src/__tests__/checkpoint.test.ts` with ≥4 tests: happy path commit, auto-rollback on throw, explicit rollback on `{rollback:true}`, nested file tracking
- Transaction method exported from checkpoint.ts

## Goal 2: Tool retry with exponential backoff in tool-recovery.ts  
**Files**: `src/tool-recovery.ts`
**LOC delta**: +30-50 lines
**What**: Add a `retryWithBackoff(fn, opts)` utility that retries failed tool executions with exponential backoff + jitter. Currently tool-recovery.ts handles error classification but has no retry logic — failures just get reported.

**Implementation**:
```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500, maxDelayMs = 10000 } = opts;
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * 2 ** attempt + Math.random() * 200, maxDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
```

**Acceptance criteria**:
- `npx tsc --noEmit` passes  
- Add ≥3 tests to existing or new test file: succeeds on first try, succeeds after retry, exhausts retries and throws
- Function exported from tool-recovery.ts

Next expert (iteration 485): **Architect**
