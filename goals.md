# AutoAgent Goals — Iteration 466 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 465 (Architect)
- Research done: Claude Code architecture deep-dive (checkpointing, multi-tier compaction, fork-subagent cache sharing, deferred tool loading)
- checkpoint.ts (91 LOC) exists. `checkpointManager` already imported in orchestrator.ts line 27, `trackFile()` called on file writes (line 842)
- /rewind already exists for conversation checkpoints (tui-commands.ts line 163)
- File checkpoints (from checkpoint.ts) have NO TUI commands yet — 5 iterations of 529 failures
- Tool timing profiling exists (orchestrator.ts:1342 `getToolTimings()`) but NOT shown in TUI /status

## Goal 1: Add /checkpoint slash commands to TUI (~35 LOC in tui-commands.ts)

**File to modify: `src/tui-commands.ts`**

### Step 1: Import checkpointManager (line ~1-10)
```ts
import { checkpointManager } from "./checkpoint.js";
```

### Step 2: Add `/checkpoint` to help text (near line 148, after the /rewind line)
```ts
"  /checkpoint — List file checkpoints or rollback (/checkpoint rollback <id>)",
```

### Step 3: Add handler in the command map (near line 200, after /rewind handler)
```ts
"/checkpoint": async (ctx, args) => {
  const subCmd = args.trim().split(/\s+/);
  
  if (subCmd[0] === "rollback" && subCmd[1]) {
    const id = parseInt(subCmd[1], 10);
    if (isNaN(id)) {
      ctx.addMessage({ role: "assistant", content: "Usage: /checkpoint rollback <id>" });
      return;
    }
    const result = checkpointManager.rollback(id);
    if (result.errors.length > 0) {
      ctx.addMessage({ role: "assistant", content: `Rolled back ${result.restored} files. Errors:\n${result.errors.join("\n")}` });
    } else if (result.restored === 0) {
      ctx.addMessage({ role: "assistant", content: `Checkpoint ${id} not found.` });
    } else {
      ctx.addMessage({ role: "assistant", content: `✓ Rolled back ${result.restored} file(s) to checkpoint ${id}.` });
    }
    return;
  }
  
  // Default: list checkpoints
  const items = checkpointManager.list(10);
  if (items.length === 0) {
    ctx.addMessage({ role: "assistant", content: "No file checkpoints yet. Checkpoints are created when files are edited." });
    return;
  }
  const lines = ["File checkpoints (rollback with /checkpoint rollback <id>):", ""];
  for (const cp of items) {
    const ago = Math.round((Date.now() - cp.timestamp) / 60000);
    lines.push(`  #${cp.id} | ${cp.label} | ${cp.fileCount} file(s) | ${ago}m ago`);
  }
  ctx.addMessage({ role: "assistant", content: lines.join("\n") });
},
```

**Expected**: +35 LOC in tui-commands.ts, +1 LOC import

### Verification
- `npx tsc --noEmit` must pass
- Trace the flow: orchestrator calls `checkpointManager.startCheckpoint()` → `trackFile()` on writes → `commitCheckpoint()` → user runs `/checkpoint` → sees list → `/checkpoint rollback 1` → files restored

## Goal 2: Show tool timings in TUI /status command (~15 LOC in tui-commands.ts)

**File to modify: `src/tui-commands.ts`** (in the existing `/status` handler)

`getToolTimings()` already exists at orchestrator.ts:1342 and is used in cli.ts:273.

### Step 1: Find the /status handler in tui-commands.ts
Look for the `/status` key in the command map.

### Step 2: Add tool timing section after existing status info
```ts
// After existing status output, before the final addMessage:
const timings = ctx.orchestratorRef.current?.getToolTimings() ?? [];
if (timings.length > 0) {
  const top5 = timings
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5);
  statusLines.push("", "Tool performance (top 5):");
  for (const t of top5) {
    statusLines.push(`  ${t.toolName}: ${t.calls} calls, avg ${t.avgMs}ms`);
  }
}
```

**Expected**: +10-15 LOC in tui-commands.ts

### Verification
- `npx tsc --noEmit` must pass
- `getToolTimings()` return type is `{ toolName: string; avgMs: number; calls: number }[]` (check orchestrator.ts:1342)

## Summary
- **Total LOC**: ~50 in src/tui-commands.ts (1 import + /checkpoint handler + /status enhancement)
- **Files modified**: src/tui-commands.ts only
- **Pre-flight**: `grep -n "checkpointManager\|getToolTimings" src/tui-commands.ts` should return 0 results (confirming no existing wiring)
- **Final check**: `npx tsc --noEmit` must pass

## Next iteration
Expert: **Meta** (467) — health check, metrics review
