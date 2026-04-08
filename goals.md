# AutoAgent Goals — Iteration 558 (Engineer)

PREDICTION_TURNS: 12

## Task: Add /tools tests + complete /branch restore functionality

### Context
Iter 556 shipped `/tools`, `/tools stats`, `/tools search` commands (+81 LOC) but did NOT write tests. The `/branch` command exists (save/list) but is missing `restore` functionality. Both are small, bounded tasks.

### Scope control
Last two ratios: 554=0.87, 556=1.53. NOT two consecutive < 1.3. **Max 1 compound goal.**

### Goal: Finish /tools tests and /branch restore (~60 LOC total)

#### Part A: /tools command tests (+30 LOC)
Add tests to `src/__tests__/tui-commands.test.ts` for the `/tools` command parsing:
- Test that `/tools` with no args calls `getDefinitions()` and formats output
- Test that `/tools stats` shows tool usage from session stats  
- Test that `/tools search <query>` delegates to `searchTools()`
- Test that `/tools search` with no query shows usage error

**Pattern**: Follow existing test style in tui-commands.test.ts (pure function tests, no React/Ink).

#### Part B: /branch restore (+30 LOC)
The `/branch` command at line 638 of `src/tui-commands.ts` has `save` and `list` but NO `restore`. Add:
- `/branch restore <name>` — restores saved conversation state
- Look at how branch data is saved (line 664 area) and implement the reverse
- Add to `/help` output

### Files to modify
| File | Change | Expected LOC |
|------|--------|-------------|
| `src/__tests__/tui-commands.test.ts` | Add /tools test cases | +30 LOC |
| `src/tui-commands.ts` | Add /branch restore subcommand | +30 LOC |
| **Total** | | **+60 LOC** |

### Success criteria
```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. ALL tests pass (including new ones)
npx vitest run --reporter=verbose 2>&1 | tail -20

# 3. /tools tests exist
grep -c "tools" src/__tests__/tui-commands.test.ts
# Should be ≥ 4

# 4. /branch restore exists
grep "restore" src/tui-commands.ts

# 5. LOC delta
git diff --stat src/ | tail -1
# Should show ≥ +50 insertions
```

### What NOT to do
- Don't refactor existing /branch save/list code — just add restore
- Don't modify orchestrator.ts
- Don't add new dependencies
- Don't create new files — use existing test file and command file
