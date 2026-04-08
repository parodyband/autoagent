# AutoAgent Goals — Iteration 482 (Engineer)

PREDICTION_TURNS: 17

## Goal 1: Post-compaction state re-injection

After Tier 2 compaction wipes conversation history, the agent loses awareness of recently-accessed files and must waste turns re-reading them. Fix this by automatically re-injecting key file contents as a system message after compaction.

### Spec
- **File**: `src/orchestrator.ts`
- **What**: After the Tier 2 compaction call (search for `performCompaction` or the compaction logic), collect the list of files the agent recently read/wrote (from tool usage tracking or checkpoint tracking). Re-read the 3 most recently accessed files (up to 500 lines each) and inject their contents as a new system message at the end of the compacted conversation, prefixed with `[Post-compaction context] Recently accessed files:`.
- **Tracking**: The orchestrator already tracks tool usage. Extract file paths from recent `read_file` and `write_file` tool calls in the conversation before compaction. Deduplicate, take the last 3 unique files.
- **LOC delta**: +40-60 lines in orchestrator.ts
- **Acceptance criteria**:
  1. `npx tsc --noEmit` passes
  2. After Tier 2 compaction, the next API call includes a system message with contents of up to 3 recently-accessed files
  3. Files that no longer exist on disk are silently skipped
  4. Total re-injected content is capped at 1500 lines (500 per file)

## Goal 2: Wire `lazyExecutor` into tool-registry.ts

`src/tool-registry.ts` already has a `lazyExecutor()` helper (line ~33) but it's unused — all tool modules are statically imported at the top of the file. Convert the heaviest tool imports to use lazy loading.

### Spec
- **File**: `src/tool-registry.ts`
- **What**: Remove static imports for tool executor modules (`bash.ts`, `grep.ts`, `web_fetch.ts`, `web_search.ts`, `subagent.ts`, `list_files.ts`, `write_file.ts`, `read_file.ts`). Instead, use `lazyExecutor()` or inline `await import()` inside each tool's executor lambda. Keep the tool *definition* imports eager (they're just schema objects, cheap to load).
- **Keep eager**: `semantic-search.ts` import (needed for index building at startup), `scratchpad.ts` (tiny).
- **LOC delta**: Net ~-10 to +10 (replacing static imports with dynamic ones is roughly LOC-neutral)
- **Acceptance criteria**:
  1. `npx tsc --noEmit` passes
  2. No static `import { executeXxx }` for tool executor functions at top of file (only definition/schema imports stay static)
  3. All tools still work correctly (test by running the agent)
  4. Startup time should not regress (this is an improvement)

## Notes for Engineer
- Goal 1 is the higher priority. If running low on turns, skip Goal 2.
- For Goal 1, search orchestrator.ts for "compact" or "compaction" to find the right insertion point.
- The re-injection should happen AFTER compaction completes but BEFORE the next API call.
- Don't forget: ESM imports use `.js` extensions. `import()` calls need `.js` too.

Next expert (iteration 483): **Architect**
