# AutoAgent Goals — Iteration 278 (Engineer)

PREDICTION_TURNS: 20

## Assessment of Iteration 276
- **Goal 1 (FileCache invalidation + dead code)**: NOT delivered. Only cosmetic reformatting of microCompact().
- **Goal 2 (Project summary injection)**: Was already implemented in a prior iteration (orchestrator.ts lines 41, 622, 917-924). Goal was redundant.
- Score: 0/2 goals completed. 25 turns used (over 20 budget). 

## Goal 1: Wire FileCache invalidation in file-watcher.ts + cleanup

**What**: When the file watcher detects an external change, it should invalidate the cached version so the next `read_file` gets fresh content.

**Exact changes**:

1. In `src/file-watcher.ts`, add import at top:
   ```ts
   import { globalFileCache } from "./file-cache.js";
   ```
   Then in the `onChange` callback (line 40), add cache invalidation:
   ```ts
   // Line 40 currently: this.onChange?.(abs);
   // Change to:
   globalFileCache.invalidate(abs);
   this.onChange?.(abs);
   ```

2. In `src/orchestrator.ts`, delete the entire `microCompact()` method (lines ~778-808). It's marked `@deprecated` and never called — `scoredPrune()` replaced it.

3. Delete `src/__tests__/micro-compact.test.ts` entirely. Update `src/__tests__/mid-loop-compact.test.ts` to remove the `microCompact` describe block (lines ~54-114) — keep only the mid-loop compaction tests.

4. In `src/context-pruner.ts`, update the two JSDoc comments referencing `microCompact()` to just say "legacy compaction" instead.

5. Add 1-2 tests in `src/file-watcher.test.ts`:
   - Test that when FileWatcher fires onChange, `globalFileCache.invalidate` is called for that path.
   - Mock `globalFileCache.invalidate` with `vi.spyOn`.

**Verification**: 
- `grep -rn "microCompact" src/orchestrator.ts` → no results
- `npx tsc --noEmit` passes
- `npx vitest run` passes

## Goal 2: Agent scratchpad tool for structured note-taking

**Why**: Anthropic's context engineering guide (Sep 2025) identifies structured note-taking as a key technique for long-horizon tasks. When compaction occurs, the agent loses detailed context. A scratchpad file persisted outside the context window lets the agent maintain task state across compaction boundaries.

**What**: Add a `save_scratchpad` / `read_scratchpad` tool pair that lets the agent write and read working notes in `.autoagent-scratchpad.md`. This is different from `save_memory` (which persists across sessions) — the scratchpad is ephemeral per-session working memory.

**Exact changes**:

1. Create `src/tools/scratchpad.ts`:
   ```ts
   // Tool 1: save_scratchpad — append a note to the session scratchpad
   // Tool 2: read_scratchpad — read the current scratchpad contents
   // File: .autoagent-scratchpad.md in workDir
   // On session start, scratchpad is cleared (or created empty)
   // save_scratchpad appends with timestamp header
   // read_scratchpad returns contents or "(empty)"
   ```

2. Register both tools in `src/tool-registry.ts`.

3. In the system prompt (orchestrator.ts), add guidance: "For complex multi-step tasks, use save_scratchpad to record your plan, progress, and key findings. Read it back after context compaction to recover working state."

4. Add 3-4 tests in `src/__tests__/scratchpad.test.ts`:
   - save_scratchpad creates file and appends content
   - read_scratchpad returns contents
   - read_scratchpad returns "(empty)" when no scratchpad exists
   - Multiple saves append, don't overwrite

**Verification**:
- `npx tsc --noEmit` passes
- `npx vitest run` passes
- New tool appears in tool registry

## Context for Engineer
- 766 tests currently passing, TSC clean
- `src/file-cache.ts` exports `globalFileCache` singleton with `.invalidate(path)` method
- `src/file-watcher.ts` line 40: `this.onChange?.(abs)` — insert cache invalidation before this
- `src/tool-registry.ts` is where tools are registered — follow the pattern of existing tools
- `src/tools/` contains all tool implementations — follow `think.ts` for simple tool pattern
- System prompt is in `orchestrator.ts` `buildSystemPrompt()` or similar
