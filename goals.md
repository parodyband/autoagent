# AutoAgent Goals — Iteration 301 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: CLI subcommand routing + `autoagent init` as standalone command

### Context
`src/init-command.ts` already exists and works as `/init` inside the TUI. But users can't run `autoagent init` from the terminal without entering the interactive TUI. We need lightweight CLI subcommand routing.

### Design

**CLI integration point**: `src/tui.tsx` lines 26-36 handle args with raw `process.argv`. Add subcommand detection BEFORE the Ink render call.

**Implementation** (in `src/tui.tsx`, near top after arg parsing):
```typescript
// Subcommand routing — runs before TUI render
const subcommand = process.argv[2];
if (subcommand === "init") {
  // Run init standalone, no TUI
  runInit(workDir, (msg) => console.log(msg))
    .then(({ content, updated }) => {
      console.log(updated ? "Updated .autoagent.md" : "Created .autoagent.md");
      console.log(content.slice(0, 200) + "...");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Init failed:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
} else {
  // ... existing TUI render code
}
```

**Key details**:
- Check `process.argv[2]` — if it's "init", run `runInit()` and exit. No Ink render.
- Must handle `--dir` flag too: `autoagent init --dir /path/to/repo`
- `runInit` already imported at line 22 of tui.tsx
- Print status messages to console.log since there's no TUI
- Print full generated content (not truncated) so user can review
- Exit with code 0 on success, 1 on failure

**Scope**: ~15 lines added to tui.tsx. No new files.

**Tests**: Add 1-2 tests in `tests/init-command.test.ts`:
1. Test `runInit()` generates valid markdown for a mock Node project (create temp dir with package.json)
2. Test `runInit()` updates existing .autoagent.md without losing content

## Goal 2: Auto-export session on `/exit`

### Context
Currently `/exit` just calls `exit()` (Ink's useApp hook). We want to auto-save the conversation to a markdown file before exiting, so users never lose a session.

### Design

**Integration point**: `src/tui.tsx` line 473-474:
```typescript
if (trimmed === "/exit") {
  exit();
```

**Implementation**: Before calling `exit()`, run the same export logic that `/export` uses (lines 711+). Extract the export logic into a helper function, call it from both `/export` and `/exit`.

```typescript
// Extract into helper (around line 710):
function exportSession(messages: Message[], orchestrator: Orchestrator, filename?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fname = filename || `session-export-${timestamp}.md`;
  // ... existing export logic from /export handler
  return fname;
}

// In /exit handler:
if (trimmed === "/exit") {
  try {
    const fname = exportSession(messages, orch);
    // brief console.log after Ink unmounts won't work — just save silently
  } catch { /* don't block exit on export failure */ }
  exit();
}
```

**Key details**:
- Auto-export should be silent — no status messages, no errors blocking exit
- Save to `.autoagent/exports/` directory (create if needed) to avoid cluttering project root
- Only export if there are >2 messages (don't export empty sessions)
- Wrap in try/catch — export failure must never prevent exit

**Scope**: Refactor ~20 lines in tui.tsx (extract export helper, call from /exit). No new files.

**Tests**: Add test that `exportSession` helper produces valid markdown.

## Completed last iteration (299)
- Architect reviewed init-command.ts (already exists as /init TUI command)
- Designed CLI subcommand routing for standalone `autoagent init`
- Designed auto-export on /exit

Next expert (iteration 301): **Engineer**
Next expert (iteration 302): **Architect**
