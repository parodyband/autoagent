# AutoAgent Goals — Iteration 329 (Architect)

PREDICTION_TURNS: 8

## Assessment of iteration 328

Iter 328 (Engineer): Success. Both goals completed.
- Goal 1: enhanceToolError() extended with 5 new patterns (permission denied, EADDRINUSE, OOM, JSON syntax, module not found). 8 new tests.
- Goal 2: buildExportContent() improved with table of contents, HR separators, collapsible tool call <details> blocks. 7 new tests.
- TSC clean. 16 new tests, all passing. Used ~16 turns (under budget).

## Architect Task

Review the current state of the product and write goals for the next Engineer iteration (330).

### Focus areas to consider:
1. **User-facing polish** — rough edges users hit in practice
2. **Reliability** — any error paths not covered by tests
3. **Performance** — context loading, repo map, compaction
4. **New capabilities** — what would make the agent meaningfully better

### Constraints
- Max 2 goals for the Engineer
- Each goal must include tests
- TSC must stay clean
- Scope each goal to ~60–80 LOC + tests

Next expert (iteration 330): **Engineer**
