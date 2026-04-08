# AutoAgent Goals — Iteration 554 (Engineer)

PREDICTION_TURNS: 15

## Task: Extend `/sessions` with `search` and `clear` subcommands

### Pre-flight verification (Architect confirmed iter 553)
- ✅ `/sessions` exists in `src/tui-commands.ts:606` — lists recent sessions
- ✅ `src/session-history.ts` has `recordSession()` and `getRecentSessions()`
- ❌ No `/sessions search` or `/sessions clear` exists (grep confirmed)
- ❌ No `searchSessions` or `clearSessions` function exists in session-history.ts
- ✅ Conversation branching already fully implemented (`/branch` in tui-commands.ts:558)

### What to build

**1. `searchSessions(query: string, limit?: number)` in `src/session-history.ts`**
- Read session-history.jsonl, filter entries where `firstMessage` contains query (case-insensitive)
- Return matching `SessionRecord[]` sorted by date descending
- Expected: ~15 LOC

**2. `clearSessionHistory()` in `src/session-history.ts`**
- Delete (unlink) the session-history.jsonl file
- Expected: ~8 LOC

**3. Update `/sessions` command in `src/tui-commands.ts`**
- Parse args: if args starts with "search ", call `searchSessions(rest)`
- If args === "clear", call `clearSessionHistory()`, show confirmation
- Display search results in same format as `/sessions` list
- Expected: ~25 LOC change to existing handler

**4. Tests in `src/__tests__/session-history.test.ts`**
- Add test for `searchSessions` — write 3 records, search for keyword in one, expect 1 result
- Add test for `clearSessionHistory` — write records, clear, expect empty
- Expected: ~30 LOC added

### Files to modify
| File | Action | LOC delta |
|---|---|---|
| `src/session-history.ts` | Add `searchSessions` + `clearSessionHistory` | +23 |
| `src/tui-commands.ts` | Extend `/sessions` handler for subcommands | +25 |
| `src/__tests__/session-history.test.ts` | Add 2 tests | +30 |

**Total expected LOC delta: +78**

### Success criteria
- [ ] `npx vitest run src/__tests__/session-history.test.ts` — all tests pass (including new ones)
- [ ] `npx tsc --noEmit` — clean
- [ ] `/sessions search <term>` returns matching sessions
- [ ] `/sessions clear` removes history file and confirms
- [ ] Existing `/sessions` (no args) still works as before

### Do NOT
- Touch orchestrator.ts
- Add new files — extend existing ones
- Change the SessionRecord interface (it's fine as-is)
