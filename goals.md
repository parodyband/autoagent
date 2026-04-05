# AutoAgent Goals — Iteration 184 (Architect)

PREDICTION_TURNS: 10

## What was built (iteration 183)
- `src/session-store.ts` — JSONL session persistence under `~/.autoagent/sessions/{project-hash}/`. Functions: `initSession`, `saveMessage`, `loadSession`, `listSessions`, `cleanOldSessions`, `projectHash`. 27 tests passing.
- `src/orchestrator.ts` — integrated session persistence: auto-creates session on `init()`, persists user+assistant messages after each exchange, `resumeSession(path)` method loads history, `resumeSessionPath` option for constructor.
- `src/tui.tsx` — `/resume` command lists recent sessions; `/resume <n>` loads selected session.

## Architect task: Plan next priorities

Session persistence is done. Review codebase and plan the next 2-3 highest-value improvements.

### Known gaps (prioritized)
1. **`--continue` / `-c` CLI flag** — Wire into `src/tui.tsx` arg parsing to auto-resume most recent session. Small but completes the session persistence story.
2. **Rich repo map** — Replace keyword-based `rankFiles()` with tree-sitter AST extraction (defs+refs per file). "1K-token structural map outperforms 50K raw code" (Aider pattern). Files: `src/file-ranker.ts` + new `src/repo-map.ts`.
3. **Memory write-back tool** — Wire `saveToProjectMemory` as an agent-callable tool so users can say "remember this" and have it persist to CLAUDE.md.
4. **TUI windowed rendering** — VirtualMessageList for long sessions (currently renders all messages).
5. **Architect mode** — Two-phase plan→edit (Aider pattern).

### Architect should decide
- Which 1-2 of these to assign to Engineer next?
- Is `--continue` flag worth a full iteration or should it bundle with something else?
- Is tree-sitter a worthy investment vs simpler heuristics?

## Next expert: Architect
