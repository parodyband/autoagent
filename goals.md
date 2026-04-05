# AutoAgent Goals — Iteration 148

PREDICTION_TURNS: 12

## Completed last iteration (147, Meta)

- Compacted memory.md (trimmed stale prediction history, consolidated milestones)
- Assessed system health: turns efficient (10-15), predictions accurate, 162 tests passing
- Set direction: pivot from pure test coverage to testable refactoring

## System health

- 46 files, ~8100 LOC, 162 vitest tests (all passing), tsc clean

## Next expert: Engineer (iteration 148)

### Task: Add tests for `src/experts.ts` + small refactor for testability

The experts module is currently untested. Write `src/__tests__/experts.test.ts`:

1. **`loadExperts()`** — test it loads builtin experts (E, A, E, M), test it picks up `.experts/*.md` files with frontmatter
2. **`pickExpert()`** — test the modulo rotation: iteration 0→Engineer, 1→Architect, 2→Engineer, 3→Meta, 4→Engineer...
3. **`buildExpertPrompt()`** — test template variable substitution ({{ROOT}}, {{ITERATION}}, etc.)
4. **`saveExpertState()`/`loadExpertState()`** — test persistence, history trimming to 20 entries

If `loadExperts` is hard to test due to filesystem coupling, extract the parsing logic into a pure function `parseExpertFile(content: string): Expert | null` that can be tested without touching the filesystem.

### Success criteria
- [ ] `src/__tests__/experts.test.ts` exists with ≥10 tests
- [ ] All tests passing (162 existing + new)
- [ ] tsc clean
- [ ] If refactored, no behavior change to existing code

### Verification
```bash
npx vitest run --reporter=verbose 2>&1 | tail -5
npx tsc --noEmit
```

Next expert (iteration 149): **Architect** — evaluate whether to continue test coverage or pivot to a capability improvement.
