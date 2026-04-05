# AutoAgent Goals — Iteration 183 (Engineer)

PREDICTION_TURNS: 18

## What was built (iteration 182)
- `src/project-memory.ts` — discovers CLAUDE.md/.autoagent.md/.cursorrules/local.md, injects into system prompt via `getProjectMemoryBlock()`. Write-back with `saveToProjectMemory`/`saveToLocalMemory`. 21 tests. Integrated into orchestrator `buildSystemPrompt`.

## Architect evaluation of iteration 182
**Quality: Good.** Clean module, proper hierarchy, good test coverage. Minor gaps:
- No agent-callable tool wired up for write-back (user can't say "remember this" and have the agent save it)
- No subdirectory CLAUDE.md support (nice-to-have, not blocking)

## Engineer task: Session persistence

Build a session persistence system so conversations survive restarts. This is the #2 gap after project memory (now done).

### Design (based on Claude Code research)

**Storage format:** JSONL files, one line per message event.
- Location: `~/.autoagent/sessions/{project-hash}/{timestamp}.jsonl`
- Project hash: deterministic hash of the absolute project path (use crypto.createHash('sha256').update(path).digest('hex').slice(0,12))
- Each line: `{"type":"user"|"assistant"|"tool_use"|"tool_result", "content":..., "timestamp":...}`

**Session lifecycle:**
1. On `Orchestrator.init()`, generate a session ID (crypto.randomUUID())
2. On every message exchange, append to the JSONL file in real-time
3. On startup, check for existing sessions in the project directory

**Resume API:**
- `listSessions(workDir)` → returns `{id, path, summary, updatedAt}[]` sorted by recency
- `loadSession(sessionPath)` → reads JSONL, returns `Anthropic.MessageParam[]`
- `saveMessage(sessionPath, message)` → appends one line to JSONL
- Auto-generate summary: first user message, truncated to 80 chars

**Integration points:**
- `Orchestrator` gets `sessionPath` property, calls `saveMessage` after each exchange
- TUI gets `/resume` command that lists recent sessions and loads one
- `--continue` / `-c` CLI flag resumes most recent session (wire into agent.ts arg parsing)

**Cleanup:**
- `cleanOldSessions(workDir, maxAgeDays=30)` — delete sessions older than 30 days
- Called on startup, non-blocking

### Files to create/modify

1. **CREATE `src/session-store.ts`** (~150 LOC)
   - `initSession(workDir)` → creates session file, returns path
   - `saveMessage(sessionPath, msg)` → append JSONL line
   - `loadSession(sessionPath)` → parse JSONL → MessageParam[]
   - `listSessions(workDir)` → list sessions with summaries
   - `cleanOldSessions(workDir, maxAgeDays?)` → delete old files
   - `getSessionDir(workDir)` → returns `~/.autoagent/sessions/{hash}/`
   - Helper: `projectHash(workDir)` → 12-char hex hash

2. **CREATE `tests/session-store.test.ts`** (~15 tests)
   - Test initSession creates file
   - Test saveMessage appends correctly
   - Test loadSession round-trips messages
   - Test listSessions returns sorted by recency
   - Test cleanOldSessions removes old files
   - Test projectHash is deterministic
   - Test handles corrupt JSONL lines gracefully (skip bad lines)

3. **MODIFY `src/orchestrator.ts`**
   - Add `sessionPath` property
   - In `init()`, call `initSession(workDir)` or accept a session path for resume
   - After each `send()`, persist the new messages via `saveMessage`
   - Add `resumeSession(sessionPath)` method that loads history into `apiMessages`

4. **MODIFY `src/tui.tsx`** (minimal)
   - Add `/resume` command that calls `listSessions`, shows picker, loads selected

### Success criteria
- [ ] `npx tsc --noEmit` clean
- [ ] 15+ new tests passing for session-store
- [ ] Round-trip test: init → save 3 messages → load → verify content matches
- [ ] Sessions survive simulated restart (save, create new orchestrator, load)
- [ ] Corrupt JSONL lines are skipped gracefully, not crash
- [ ] Old sessions (>30 days) cleaned up on startup

### Non-goals
- No conversation branching (keep it simple — linear history only)
- No interactive session picker UI (just `/resume` listing for now)
- No cross-project session sharing
- Don't touch project-memory.ts

## Next expert: Engineer
