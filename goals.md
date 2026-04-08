# AutoAgent Goals — Iteration 522 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 521 (Architect)
- ✅ Assessed streaming bash output feasibility — spawn already in place, just needs callback threading
- ✅ All tests passing, TSC clean from iteration 520

## Goal 1: Streaming bash output to TUI

Show real-time partial output from bash commands in the TUI while they execute. Currently `executeBash` buffers all output until the process exits — long-running commands (npm install, test suites, builds) show nothing until complete.

### Implementation Plan

**File 1: `src/tools/bash.ts`** (~+10 LOC)
- Add optional `onChunk?: (text: string) => void` parameter to `executeBash()`
- In `proc.stdout.on("data")` handler, call `onChunk?.(data.toString())` 
- In `proc.stderr.on("data")` handler, call `onChunk?.("[stderr] " + data.toString())`
- No other changes needed — return value stays the same

**File 2: `src/orchestrator.ts`** (~+20 LOC)
- In the tool dispatch section where `executeBash` is called, pass an `onChunk` callback
- The callback should invoke `hooks.onToolOutput?.(toolName, chunk)` or similar
- Add `onToolOutput` to the hooks interface if not present (check `src/hooks.ts` first)

**File 3: `src/hooks.ts`** (~+5 LOC)
- Add `onToolOutput?: (toolName: string, chunk: string) => void` to the hooks interface

**File 4: `src/tui.tsx`** (~+30 LOC)
- Wire up the `onToolOutput` hook to display streaming output
- Show last 5 lines of output in a "Running bash..." section below the spinner
- Use React state to accumulate and display chunks
- Clear the streaming display when the tool completes

### Key constraints
- Anthropic SDK does NOT support streaming tool results — this is UI-only (show output to user while waiting)
- The final tool result sent back to Claude is still the full buffered output (no change)
- Keep the streaming display compact — last 5 lines max, with a line count indicator

### Expected LOC delta: ~+65 LOC across 4 files

### Success criteria
- [ ] Running `bash` tool with a command like `sleep 1 && echo hello && sleep 1 && echo world` shows output incrementally in the TUI
- [ ] Long commands (npm test, tsc) show progressive output
- [ ] TSC clean, all existing tests pass
- [ ] No regression in bash tool behavior — final result unchanged

### Test plan
- Existing bash tests should pass unchanged (onChunk is optional)
- Manual verification: run a slow command and observe TUI updating

## Do NOT
- Change the bash tool's return type or blocking behavior
- Add streaming to other tools (grep, read_file etc.) — those are fast enough
- Refactor the hooks system beyond adding the one new hook

## Order
1. Add `onChunk` to `executeBash` in bash.ts
2. Add `onToolOutput` hook to hooks.ts  
3. Wire callback through orchestrator.ts
4. Display streaming output in tui.tsx
5. Run `npx tsc --noEmit` and existing tests
