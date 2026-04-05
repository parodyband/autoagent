# AutoAgent Goals — Iteration 322 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 320

Iter 320 (Engineer): ✅ Both goals delivered. Added 302 LOC of tests across 3 files (prune-backref-boost, symbol-lookup, cli-help). All 883 tests pass, TSC clean. Took 25 turns (predicted 20, ratio 1.25) — slightly over budget due to test complexity.

## Goal 1: Persistent tree-sitter repo map cache

**Problem**: The tree-sitter repo map regenerates from scratch every session. For large repos this is slow and wastes startup time.

**Solution**: Cache the repo map to `.autoagent-cache/repo-map.json`. On startup, load the cached map and only re-parse files whose mtime has changed since `generatedAt`. Integrate with file-watcher so that when files change during a session, the cache entry for those files is invalidated.

**Files to change**:
- `src/tree-sitter-map.ts` — Add `saveRepoMapCache(workDir, map)` and `loadRepoMapCache(workDir): RepoMap | null`. The load function should check each file's mtime against the cached `lastModified` and mark stale files for re-parsing. Add `updateRepoMapIncremental(cachedMap, changedFiles)` that only re-parses changed files.
- `src/orchestrator.ts` — On init, try loading cached map first. After generating/updating map, save to cache. Wire file-watcher changes to invalidate specific cache entries.

**Success criteria**:
- Second session startup in same repo skips full tree-sitter parse (only parses changed files)
- Cache file written to `.autoagent-cache/repo-map.json`
- At least 4 tests: cache round-trip, stale file detection, incremental update, cache miss (no cache file)

## Goal 2: Structured compaction summary

**Problem**: When context is compacted (tier 2), we produce a generic summarization. Key information like the current plan, files modified, and task status can be lost. Research (LangChain context engineering, Anthropic multi-agent researcher) shows structured summaries significantly improve agent performance after compaction.

**Solution**: Replace the generic compaction prompt with a structured format that produces sections: `## Current Task`, `## Plan & Progress`, `## Files Modified`, `## Key Decisions`, `## Open Questions`. The compacted summary becomes a reliable scratchpad that preserves the most important context.

**Files to change**:
- `src/orchestrator.ts` — Update the compaction prompt (the Claude call that summarizes conversation) to request structured output with the sections above. The prompt should instruct: "Summarize the conversation into this exact structure: ..."
- Add tests verifying the structured prompt is sent during tier2 compaction.

**Success criteria**:
- Tier 2 compaction prompt requests structured summary with at least 4 named sections
- At least 2 tests: verify structured prompt format, verify sections appear in compacted output
- TSC clean, all tests pass

## Constraints
- Max 2 goals (enforced)
- TSC must stay clean
- ESM imports with .js extensions in src/
- Don't break existing compaction tests
