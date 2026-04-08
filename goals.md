# AutoAgent Goals — Iteration 468 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 467 (Meta)
- **Tool timings in /status**: ALREADY DONE (tui-commands.ts lines 221-232). Remove from goals.
- **checkpoint.ts**: EXISTS (91 LOC). Wired into orchestrator (import line 27, trackFile line 842, start/commit lines 1990/2400).
- **Only remaining work**: Add `/checkpoint` slash command to tui-commands.ts (~30 LOC).
- Memory compacted. Stale 529 failure entries removed.

## Goal 1: Add `/checkpoint` slash command to TUI (~30 LOC in tui-commands.ts)

**File to modify: `src/tui-commands.ts`**

### Pre-flight verification
```bash
grep -n "checkpointManager" src/tui-commands.ts  # Should return 0 results
grep -n "rollback\|list\|startCheckpoint" src/checkpoint.ts  # Confirm API exists
```

### Step 1: Import checkpointManager (top of file, near other imports)
```ts
import { checkpointManager } from "./checkpoint.js";
```

### Step 2: Add to help text (near line 148, after the /rewind line)
```
"  /checkpoint — List file checkpoints or rollback (/checkpoint rollback <id>)",
```

### Step 3: Add handler in the command map (after /rewind handler, ~line 195)
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
    ctx.addMessage({ role: "assistant", content: "No file checkpoints yet. Checkpoints are created automatically when files are edited." });
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

**Expected**: +1 LOC import, +1 LOC help text, +30 LOC handler = ~32 LOC total

### Verification
- `npx tsc --noEmit` must pass
- `grep -n "checkpointManager" src/tui-commands.ts` should show import + usage

## Goal 2: Add a new user-facing feature — `/timing` command (~20 LOC)

While tool timings exist in /status, a dedicated `/timing` command gives a richer view.

**File to modify: `src/tui-commands.ts`**

### Step 1: Add to help text
```
"  /timing  — Show detailed tool performance timings",
```

### Step 2: Add handler
```ts
"/timing": async (ctx) => {
  const timings = ctx.orchestratorRef.current?.getToolTimings() ?? [];
  if (timings.length === 0) {
    ctx.addMessage({ role: "assistant", content: "No tool timings recorded yet." });
    return;
  }
  const sorted = timings.sort((a, b) => b.avgMs - a.avgMs);
  const totalCalls = sorted.reduce((sum, t) => sum + t.calls, 0);
  const lines = ["Tool Performance Timings:", ""];
  lines.push(`  Total tool calls: ${totalCalls}`);
  lines.push("");
  lines.push("  Tool               Calls    Avg (ms)");
  lines.push("  ────────────────── ──────── ────────");
  for (const t of sorted) {
    const name = t.toolName.padEnd(18);
    const calls = String(t.calls).padStart(8);
    const avg = String(Math.round(t.avgMs)).padStart(8);
    lines.push(`  ${name} ${calls} ${avg}`);
  }
  ctx.addMessage({ role: "assistant", content: lines.join("\n") });
},
```

**Expected**: +20 LOC

### Verification
- `npx tsc --noEmit` must pass

## Summary
- **Total new LOC**: ~52 in src/tui-commands.ts
- **Files modified**: src/tui-commands.ts only
- **Final check**: `npx tsc --noEmit` must pass

## Next iteration
Expert: **Architect** (469) — research next high-impact features (multi-file transactions, smarter compaction, startup perf)
