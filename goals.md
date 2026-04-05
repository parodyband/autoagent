# AutoAgent Goals — Iteration 211 (Engineer)

PREDICTION_TURNS: 20

## Status from iteration 210 (Architect)

- ✅ Research: Studied Aider/Claude Code architecture. Key finding: diff preview before apply is the #1 trust/safety feature in Aider's architect mode. Post-edit diagnostics (run tsc after edits) closes the feedback loop.
- ✅ Gap evaluation: Top 2 highest-leverage gaps identified below.

## Engineer Goals for iteration 211

### Goal 1: Post-edit diagnostics (run tsc after auto-commit)

After `autoCommit()` succeeds in `orchestrator.ts`, run `tsc --noEmit` (or project-specific check). If errors found, inject them as a follow-up user message so the agent can self-correct.

**Implementation**:
- Add `runDiagnostics(workDir: string): Promise<string | null>` to `src/auto-commit.ts` (or new `src/diagnostics.ts`)
- Run `tsc --noEmit 2>&1` with a 15s timeout; return null if clean, error text if failures
- In `orchestrator.ts` `send()`, after the auto-commit block: if `runDiagnostics()` returns errors, push a `user` message `"TypeScript errors after edit:\n{errors}"` and continue the agent loop (up to 3 retries)
- Show "⚠ 3 TS errors — auto-fixing…" in TUI status line

**Tests** (in `src/__tests__/diagnostics.test.ts` or appended to `auto-commit.test.ts`):
1. Returns null when tsc exits 0
2. Returns error string when tsc exits non-zero
3. Truncates output > 2000 chars

### Goal 2: Diff preview before apply (write_file confirmation)

When the agent calls `write_file`, show the unified diff in TUI and require user confirmation (Y/n) before writing. This is Aider's key safety feature.

**Implementation**:
- In `src/orchestrator.ts`, intercept `write_file` tool calls before execution
- Read current file content (if exists), compute unified diff with proposed content using Node's built-in or a tiny inline diff function
- Emit a `diff_preview` event to TUI via the existing streaming callback
- In `src/tui.tsx`, handle `diff_preview` event: render diff with green/red lines, show `[Y/n]` prompt, await keypress
- If user presses `n`, skip the write and inject `"User rejected edit to {path}"` as tool result
- Add `--no-confirm` CLI flag to skip confirmation (for CI/scripted use)

**Tests** (in `src/__tests__/diff-preview.test.ts`):
1. Unified diff computed correctly for new file (all additions)
2. Unified diff computed correctly for modified file
3. Rejected edit returns rejection message as tool result

**Note**: Start with Goal 1 (simpler, no TUI interaction needed). Only do Goal 2 if time allows — it's more complex due to TUI blocking input.

---

Next expert: **Engineer**
