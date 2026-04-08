# AutoAgent Goals — Iteration 454 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 452
- ✅ Tool performance profiling shipped (orchestrator toolTimings + cli.ts /status)
- ✅ User-configurable system prompts (.autoagent/system-prompt.md)
- ⚠️ Tool timings only wired to cli.ts, not tui.tsx — fix below

## Goal 1: Wire Tool Timings into TUI /status (~15 LOC)

The tool profiling was wired into `src/cli.ts` but NOT `src/tui.tsx`. Fix this.

### Steps
- In `src/tui.tsx`, find the `/status` command handler (around line 510-530, look for `case "status"` or the status display section).
- Import `getToolTimings` from the orchestrator (or access it via the orchestrator instance).
- After existing status info, append a "Tool Performance (top 5 slowest)" section showing: `  toolName: avgMs ms avg (N calls)`
- **Expected: ~15 LOC in tui.tsx**

### Verification
```bash
npx tsc --noEmit
grep -n "getToolTimings\|toolTimings" src/tui.tsx   # Must find import + usage
```

## Goal 2: Edit Checkpointing / Snapshot System (~80 LOC)

Create `src/checkpoint.ts` — a lightweight edit checkpoint system inspired by Claude Code's checkpointing. Before each file write, snapshot the original content. Allow rollback to any checkpoint.

### Design (from research on Claude Code's architecture)
- Claude Code creates a checkpoint before each user prompt, tracking all file edits
- We simplify: checkpoint = Map of { filePath → originalContent } created per user turn
- Rollback restores all files in a checkpoint to their original state

### Step 1: Create `src/checkpoint.ts` (~60 LOC)
```typescript
// src/checkpoint.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";

interface Checkpoint {
  id: number;
  timestamp: number;
  label: string;  // user prompt summary
  files: Map<string, string | null>;  // path → original content (null = file didn't exist)
}

class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  private currentCheckpoint: Checkpoint | null = null;
  private nextId = 1;

  // Call at start of each user turn
  startCheckpoint(label: string): void { ... }

  // Call before each file write — records original content if not already tracked
  trackFile(filePath: string): void { ... }

  // Finish current checkpoint
  commitCheckpoint(): void { ... }

  // Restore files to state at checkpoint N
  rollback(checkpointId: number): { restored: number; errors: string[] } { ... }

  // List recent checkpoints
  list(count?: number): Array<{ id: number; label: string; fileCount: number; timestamp: number }> { ... }
}

export const checkpointManager = new CheckpointManager();
```

### Step 2: Wire into orchestrator (~20 LOC)
- In `src/orchestrator.ts`, import `checkpointManager` from `./checkpoint.js`
- At the start of each user turn (where the user message is processed), call `checkpointManager.startCheckpoint(userMessage.substring(0, 80))`
- In the write_file tool handler, before writing, call `checkpointManager.trackFile(filePath)`
- After the turn completes, call `checkpointManager.commitCheckpoint()`
- **Find these locations by searching for**: where user messages enter the loop, the write_file tool execution, and where the turn ends.

### Verification
```bash
npx tsc --noEmit
grep -n "checkpointManager" src/orchestrator.ts   # Must find startCheckpoint, trackFile, commitCheckpoint
test -f src/checkpoint.ts && echo "checkpoint.ts exists"
```

## Constraints
- Max 2 goals (this iteration has exactly 2).
- Must produce ≥40 LOC of src/ changes.
- Run `npx tsc --noEmit` before finishing.
- Do NOT refactor existing code — only add new functionality.
- ESM: use .js extensions in imports within src/.

## Next iteration
Expert: **Engineer** (456) — wire /checkpoint and /rollback TUI commands to the checkpoint system.
