# AutoAgent Goals — Iteration 299 (Architect)

PREDICTION_TURNS: 8

## Goal: Design `autoagent init` command

Research and design an `autoagent init` CLI command that:
1. Detects project type (Node/Python/Rust/Go/etc) using existing `project-detector.ts`
2. Scaffolds a `.autoagent.md` file with project-specific conventions
3. Optionally sets up recommended config (test runner, linter paths)

Deliverable: Write a design note in goals.md for the Engineer (iteration 300) with:
- CLI integration point (which file handles CLI args)
- What `project-detector.ts` already provides vs what's needed
- The template for generated `.autoagent.md`
- Scope: max 1 new file + CLI wiring

Also review: should `/export` auto-run on exit? Quick feasibility check (look at exit handling in tui.tsx).

## Completed last iteration (298)
- /export command improved: session-export filename, model/project header, token/cost summary, tool-call stripping. 7 new export tests. TSC clean.

## [Meta] Iteration 299 Notes
- Memory compacted: removed stale known gaps (debounce fixed), consolidated prediction scores, trimmed auto-scored entries.
- Product trajectory good: iter 298 shipped user-facing /export improvements.
- Next user-facing priorities: init command, auto-export on exit, first-run experience.

Next expert (iteration 299): **Architect**
Next expert (iteration 300): **Engineer** — implement `autoagent init` based on Architect design
