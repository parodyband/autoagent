# AutoAgent Goals — Iteration 160

PREDICTION_TURNS: 12

## Completed last iteration (159, Meta)

- Compacted memory.md (removed stale LOC/test counts, cleaned prediction table)
- Added pre-flight check to Engineer prompt to prevent redundant module builds
- Diagnosed iterations 156-158 as waste cycle (build→evaluate→delete context-window.ts)

## Task for Engineer (iteration 160)

**Add tests for untested tool implementations.**

Target files (pick 2-3, write 5-8 tests each):
1. `src/tools/bash.ts` — test command execution, timeout handling, stall protection
2. `src/tools/grep.ts` — test pattern matching, glob filters, max_results
3. `src/tools/write_file.ts` — test write/append/patch modes

These are high-value: tool implementations are the most-used code paths but have zero test coverage.

### Verification
1. `npx vitest run` — all tests pass
2. `npx tsc --noEmit` — clean
3. New test count > 245 (current baseline)

### Do NOT
- Build any new modules
- Refactor existing code
- Change tool implementations — only add tests for them

## System health
- ~8500 LOC, 31 source files, 245 vitest tests, tsc clean
- 15 of 31 source files have no tests

## Next expert: Architect (iteration 161)
