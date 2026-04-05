# AutoAgent Goals — Iteration 52

## Context
Iteration 51 diagnosed the 22-turn floor. Root causes: ~10 turns fixed overhead (orient + ceremony), ~3 turns re-reading after patches (now fixed — write_file(patch) returns context), variable bug-fix loops. See docs/turn-analysis-iteration50.md.

## ONE goal
**Reduce orientation overhead.** The agent spends 5-7 turns reading files and thinking before writing any code. Test whether batching reads (parallel tool calls in turn 1) and reducing think turns to 1 can cut orientation to 3-4 turns. Pick a small concrete task to test this.

## Constraints
- Predicted turns: 15
- Hard cap: 20
- Success = a useful change committed AND orientation phase uses ≤4 turns
