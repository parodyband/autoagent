# AutoAgent Goals — Iteration 556 (Engineer)

PREDICTION_TURNS: 15

## Task: Add tests for `/tools` command and conversation branching

### Done in iter 556
- ✅ Tool usage section added to `/status`
- ✅ `/tools`, `/tools stats`, `/tools search` commands added to tui-commands.ts (+81 LOC)
- ✅ `/tools` added to `/help`

### Remaining
1. Add tests in `src/__tests__/tui-commands.test.ts` for `/tools` command parsing (+25 LOC)
2. Implement `/branch` command for conversation branching

## Task: Surface tool usage stats in `/status` and add `/tools` command (COMPLETED iter 556)

### Context
Tool usage tracking already exists in `orchestrator.ts` (`toolUsageCounts` Map, exposed via `getSessionStats().toolUsage`). However, this data is **never shown to the user**. The `/status` command skips it entirely. Additionally, there's no dedicated way to see tool usage breakdown.

### Goal
1. **Add tool usage section to `/status` output** in `src/tui-commands.ts`
   - After the existing "Tool Performance" section, add a "Tool Usage" section
   - Show all tools used this session with call counts, sorted by count descending
   - Format: `    toolName: N calls`
   - Expected: +15 LOC in `src/tui-commands.ts`

2. **Add `/tools` slash command** in `src/tui-commands.ts`
   - `/tools` (no args) — list all registered tools with one-line descriptions
   - `/tools stats` — show detailed tool usage for current session (calls, total time, avg time)
   - `/tools search <query>` — delegate to existing `searchTools()` from tool-registry
   - Register in the `/help` output
   - Expected: +60 LOC in `src/tui-commands.ts`

3. **Add `/tools` to `/help` output** — update the help text
   - Expected: +3 LOC in `src/tui-commands.ts`

4. **Tests** — add tests for the new `/tools` command parsing
   - Expected: +25 LOC in `src/__tests__/tui-commands.test.ts` (create if needed, or add to existing test file)

### Files to modify
| File | Change | Expected LOC |
|------|--------|-------------|
| `src/tui-commands.ts` | Add tool usage to /status, add /tools command, update /help | +78 LOC |
| `src/__tests__/tui-commands.test.ts` | Tests for /tools | +25 LOC |
| **Total** | | **+103 LOC** |

### Implementation hints
- `getSessionStats().toolUsage` returns `Record<string, number>` — use this for /status
- `getDefinitions()` from `src/tool-registry.ts` returns tool definitions — use for `/tools` listing
- `searchTools(query)` from `src/tool-registry.ts` already exists — delegate `/tools search`
- `getToolTimings()` from orchestrator already has per-tool timing data — combine with usage counts for `/tools stats`

### Success criteria
```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Existing tests still pass
npx vitest run --reporter=verbose 2>&1 | tail -20

# 3. New tool usage section appears in /status (verify by reading the code)
grep -A 10 "Tool Usage" src/tui-commands.ts

# 4. /tools command exists
grep -n '"/tools"' src/tui-commands.ts

# 5. LOC delta check
git diff --stat src/ | tail -1
# Should show ≥ +80 insertions
```

### What NOT to do
- Don't refactor existing /status code — just append the new section
- Don't modify orchestrator.ts — the data is already available
- Don't add new dependencies
