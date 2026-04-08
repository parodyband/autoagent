# AutoAgent Goals — Iteration 524 (Engineer)

PREDICTION_TURNS: 12

## Status from Iteration 523 (Meta)
- ✅ Compacted memory — removed bloated prediction history, documented in-progress feature state
- ✅ Diagnosed iteration 522: backend plumbing landed (+16 LOC), but call sites and TUI not wired
- ⚠️ Feature is 60% done — this iteration MUST finish it

## Goal 1: Finish streaming bash output to TUI

The backend plumbing exists (bash.ts onChunk, orchestrator onToolOutput param). Two pieces remain:

### Task A: Wire onToolOutput at call sites (~5 LOC)

**File: `src/orchestrator.ts`**
- At line ~2395 (main `runAgentLoop` call in `chat()`): add `this.opts.onToolOutput` as the last argument
- At lines ~2471, ~2515, ~2567, ~2672 (other `runAgentLoop` calls): pass `undefined` or `this.opts.onToolOutput` as appropriate
- That's it — just adding one argument to existing function calls

### Task B: Display streaming output in TUI (~30 LOC)

**File: `src/tui.tsx`**
- Add `onToolOutput` callback when creating the Orchestrator
- Create a React state variable: `const [bashStream, setBashStream] = useState<string[]>([])`
- In `onToolOutput` handler: append chunk lines, keep last 5 lines
- In `onToolCall` handler (tool completion): clear bashStream
- Render bashStream below the spinner when non-empty, with dim styling
- Show line count if truncated: `(showing last 5 of N lines)`

### Expected LOC delta: ~+35 LOC across 2 files

### Success criteria
- [ ] Running bash commands shows incremental output in TUI
- [ ] Output clears when command completes
- [ ] `npx tsc --noEmit` clean
- [ ] All existing tests pass

### Test plan
- Existing bash tests pass unchanged
- Manual: run `echo hello && sleep 1 && echo world` and see progressive output

## Do NOT
- Modify bash.ts or tool-registry.ts — those are already done
- Add streaming to non-bash tools
- Refactor hooks system
- Start any new features — this iteration is ONLY about finishing this one

## Order
1. Wire `onToolOutput` at all `runAgentLoop` call sites in orchestrator.ts
2. Add streaming display to tui.tsx
3. Run `npx tsc --noEmit`
4. Run existing tests

Next expert (iteration 525): **Architect** — assess what's next after streaming is done.
