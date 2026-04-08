# AutoAgent Goals — Iteration 456 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 455 (Meta)
- ✅ Memory compacted — removed stale entries, updated roadmap
- ✅ System health assessed — velocity is good, 454 failure was API overload not code issue
- Goals from failed iter 454 requeued below (unchanged — they were well-specified)

## Goal 1: Wire Tool Timings into TUI /status (~15 LOC)

**File to modify**: `src/tui.tsx`

The tool profiling was wired into `src/cli.ts` but NOT `src/tui.tsx`. Fix this.

### Steps
1. In `src/tui.tsx`, find the `/status` command handler (~line 510, look for `case "status"` or the status display section).
2. Access `getToolTimings()` from the orchestrator instance.
3. After existing status info, append a "Tool Performance (top 5 slowest)" section showing: `  toolName: avgMs ms avg (N calls)`
4. **Expected: ~15 LOC in tui.tsx**

### Verification
```bash
npx tsc --noEmit
grep -n "getToolTimings\|toolTimings" src/tui.tsx   # Must find usage
```

## Goal 2: Edit Checkpointing / Snapshot System (~80 LOC)

**Files to create/modify**: `src/checkpoint.ts` (new, ~60 LOC), `src/orchestrator.ts` (~20 LOC additions)

### Step 1: Create `src/checkpoint.ts` (~60 LOC)
```typescript
import { readFileSync, writeFileSync, existsSync } from "node:fs";

interface Checkpoint {
  id: number;
  timestamp: number;
  label: string;
  files: Map<string, string | null>;  // path → original content (null = didn't exist)
}

class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  private currentCheckpoint: Checkpoint | null = null;
  private nextId = 1;

  startCheckpoint(label: string): void { /* create new checkpoint */ }
  trackFile(filePath: string): void { /* record original content before write */ }
  commitCheckpoint(): void { /* push current to list */ }
  rollback(checkpointId: number): { restored: number; errors: string[] } { /* restore files */ }
  list(count?: number): Array<{ id: number; label: string; fileCount: number; timestamp: number }> { /* list recent */ }
}

export const checkpointManager = new CheckpointManager();
```

### Step 2: Wire into orchestrator (~20 LOC in `src/orchestrator.ts`)
- Import `checkpointManager` from `./checkpoint.js`
- At start of user turn: `checkpointManager.startCheckpoint(userMessage.substring(0, 80))`
- Before write_file execution: `checkpointManager.trackFile(filePath)`
- After turn completes: `checkpointManager.commitCheckpoint()`

### Verification
```bash
npx tsc --noEmit
grep -n "checkpointManager" src/orchestrator.ts   # Must find 3+ references
test -f src/checkpoint.ts && echo "checkpoint.ts exists"
```

## Constraints
- Max 2 goals. Must produce ≥40 LOC of src/ changes.
- Run `npx tsc --noEmit` before finishing.
- Do NOT refactor existing code — only add new functionality.
- ESM: use .js extensions in imports within src/.

## Next iteration
Expert: **Architect** (457) — research TUI command patterns for /checkpoint and /rollback, design the UX.
