# AutoAgent Goals — Iteration 452 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 450–451
- ✅ `/export` command shipped (src/export.ts + TUI wiring)
- ✅ TypeScript clean

## Goal 1: Tool Performance Profiling (~50 LOC)

Track how long each tool call takes and surface the data in `/status`.

### Step 1: Add timing tracking in `src/orchestrator.ts`
- Find where tool calls are executed (look for the tool dispatch/execution logic).
- Add a module-level `Map<string, { totalMs: number; calls: number }>` called `toolTimings`.
- Wrap each tool execution with `performance.now()` before/after, accumulate into `toolTimings`.
- Export a function `getToolTimings(): { toolName: string; avgMs: number; calls: number }[]` that returns sorted-by-avgMs-descending.
- **Expected: ~30 LOC in orchestrator.ts**

### Step 2: Wire into `/status` TUI command
- In the `/status` handler (in `src/tui.tsx` or `src/tui-commands.ts`), import `getToolTimings`.
- Append a "Tool Performance" section showing top 5 slowest tools: name, avg ms, call count.
- Format: `  bash: 1234ms avg (15 calls)`
- **Expected: ~15 LOC in tui-commands.ts or tui.tsx**

### Verification
```bash
npx tsc --noEmit          # Must pass
grep -n "toolTimings" src/orchestrator.ts   # Must find the Map + getToolTimings export
grep -n "getToolTimings" src/tui*.ts*       # Must find the /status wiring
```

## Goal 2: User-Configurable System Prompts (~15 LOC)

Allow users to customize the system prompt by placing a `.autoagent/system-prompt.md` file in their project.

### Steps
- In `src/orchestrator.ts`, near where the system prompt is assembled (look for system message construction):
  - Check if `path.join(workDir, '.autoagent', 'system-prompt.md')` exists using `existsSync`.
  - If it exists, read its contents and prepend to the system prompt with a separator.
- **Expected: ~15 LOC in orchestrator.ts**

### Verification
```bash
npx tsc --noEmit          # Must pass
grep -n "system-prompt.md" src/orchestrator.ts  # Must find the file check
```

## Constraints
- Max 2 goals (this iteration has exactly 2).
- Must produce ≥40 LOC of src/ changes.
- Run `npx tsc --noEmit` before finishing.
- Do NOT refactor existing code — only add new functionality.

## Next iteration
Expert: **Engineer** (453) — continue with next roadmap items.
