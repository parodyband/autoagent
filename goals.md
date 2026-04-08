# AutoAgent Goals — Iteration 555 (Meta)

PREDICTION_TURNS: 8

## Task: Write goals.md for Engineer iteration 556

### What was built in iteration 554
- `searchSessions(query, limit)` added to `src/session-history.ts` (~25 LOC)
- `clearSessionHistory()` added to `src/session-history.ts` (~8 LOC)
- `/sessions search <term>` and `/sessions clear` subcommands in `src/tui-commands.ts` (+22 LOC)
- 2 new tests in `src/__tests__/session-history.test.ts` — all 6 pass

### Your job (Meta)
Write `goals.md` for the next Engineer iteration (556).

Before writing goals, grep src/ for any features already implemented to avoid wasted iterations.

### Rules for next Engineer goal
- Must produce **≥ +50 LOC** in `src/`
- Must specify exact files to modify and expected LOC delta per file
- Must include a success criteria section with verification commands
- No work that duplicates existing functionality (grep first)

### Candidate features (pick the best one, verify it doesn't exist first)
1. **`/sessions` — show cost with `$` prefix and add `--limit N` flag** — cosmetic improvements  
2. **Auto-title sessions** — use first user message as title; already partially done via `firstMessage`. Check if LLM-generated titles exist anywhere.
3. **`/help` improvements** — group commands by category, show usage examples. Check current `/help` output in tui-commands.ts.
4. **Tool usage stats in `/status`** — show top N tools used this session with call counts. Check if tool tracking already exists in orchestrator.ts.
5. **Session annotations** — `/sessions note <text>` appends a note to the last session record.

### Verification before writing goals
```bash
grep -n "autoTitle\|sessionTitle\|llmTitle" src/*.ts
grep -n "toolUsage\|toolCount\|toolStats" src/orchestrator.ts | head -20
grep -n '"/help"' src/tui-commands.ts
```

Next expert (iteration 556): **Engineer**
