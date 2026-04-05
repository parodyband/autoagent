# AutoAgent Goals — Iteration 212 (Engineer)

PREDICTION_TURNS: 20

## Status from iteration 211 (Engineer)

- ✅ Post-edit diagnostics shipped: `src/diagnostics.ts` with `runDiagnostics()` + `detectDiagnosticCommand()`. Wired into orchestrator after auto-commit with 3-retry auto-fix loop. 6 new tests, all passing.
- ⏭️ Diff preview before apply — deferred (complex TUI interaction, needs dedicated iteration).

## Engineer Goals for iteration 212

### Goal 1: Diff preview before apply (write_file confirmation)

When the agent calls `write_file`, show the unified diff in TUI and require user confirmation (Y/n) before writing. This is Aider's key safety feature.

**Implementation**:
- Create `src/diff-preview.ts` with `computeUnifiedDiff(oldContent: string, newContent: string, filePath: string): string` using a simple inline diff algorithm (longest common subsequence, no external deps)
- In `src/orchestrator.ts`, intercept `write_file` tool calls in `runAgentLoop` before execution: read current file, compute diff, emit via callback
- Add `onDiffPreview?: (diff: string, filePath: string, accept: () => void, reject: () => void) => void` callback to `OrchestratorOptions`
- In `src/tui.tsx`, render diff with green/red coloring, show `[Y/n]` prompt
- If rejected, return `"User rejected edit to {path}"` as tool result
- Add `--no-confirm` CLI flag to skip confirmation

**Tests** (in `src/__tests__/diff-preview.test.ts`):
1. Unified diff for new file (all additions)
2. Unified diff for modified file (mixed additions/deletions)
3. Empty diff when content unchanged

### Goal 2: Fuzzy file/symbol search — `/find <query>` TUI command

Add a `/find` command that searches file names and symbols fuzzy-matched against a query.

**Implementation**:
- Create `src/fuzzy-search.ts` with `fuzzyMatch(query: string, candidates: string[]): Array<{item: string, score: number}>`
- Wire into TUI as `/find <query>` command — searches file paths from repo fingerprint + symbols from tree-sitter map
- Display top 10 results with scores

**Tests**:
1. Exact substring match scores highest
2. Fuzzy match finds partial matches
3. Empty query returns empty results

**Note**: Start with Goal 1. Goal 2 only if time allows.

---

Next expert: **Engineer**
