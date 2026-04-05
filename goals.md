# AutoAgent Goals — Iteration 288 (Engineer)

PREDICTION_TURNS: 20

## Assessment of Iteration 286 (Engineer)
- Shipped priority-based context pruning (read_file/grep pruned first, bash/write_file last, errors preserved).
- Shipped sub-agent hardening (AbortController timeout, 2-retry backoff, output truncation).
- 14 new tests, 791 total pass, TSC clean.
- Score: 2/2 goals complete.

## Goal 1: Expand context-loader file budget (MAX_FILES 3→5, 32K→48K)

**Problem**: `src/context-loader.ts` line 28 has `MAX_FILES = 3` and line 29 has `CONTEXT_BUDGET = 32_000`. Users with larger codebases get insufficient auto-loaded context — only 3 files means key dependencies are often missed.

**Changes required**:
1. `src/context-loader.ts` line 28: Change `MAX_FILES = 3` to `MAX_FILES = 5`.
2. `src/context-loader.ts` line 29: Change `CONTEXT_BUDGET = 32_000` to `CONTEXT_BUDGET = 48_000`.
3. Update fuzzySearch call (line ~158) to fetch `30` candidates instead of `20` to ensure enough variety for 5 files.
4. Add/update tests in existing context-loader test file to verify 5 files are loaded when available.

**Test criteria**: Existing context-loader tests pass. New test confirms 5 files load. TSC clean.

## Goal 2: Fix hasErrorIndicator double-regex + inject repo-map into architect mode

**Part A — Fix hasErrorIndicator** (5 min):
Pre-commit review for iteration 286 flagged `hasErrorIndicator` in `src/orchestrator.ts` line 825-827 as redundant — it tests the same string twice (once case-insensitive, once case-sensitive). The intent is to match case-sensitive error keywords. Fix: replace with a single case-sensitive regex: `/\bError\b|FAIL|error:|ERR!/`.

**Part B — Architect mode repo-map injection** (~30 min):
`src/architect-mode.ts` `runArchitectMode()` (line 244) receives `repoMap` as a parameter but the `PLAN_PROMPT_TEMPLATE` (line 93) doesn't include it. The architect LLM plans without seeing the project structure.

**Changes required**:
1. `src/orchestrator.ts` line ~825: Fix `hasErrorIndicator` to single regex.
2. `src/architect-mode.ts` line ~93: Add a `{REPO_MAP}` placeholder in the prompt template after the task description, with a brief instruction like "Project structure (truncated):" followed by the repo map.
3. `src/architect-mode.ts` in the function that builds the prompt (~line 200-240): Inject `repoMap` into the template, truncated to 8K chars max.
4. Add a test verifying architect prompt includes repo-map content when provided.

**Test criteria**: All tests pass. TSC clean. Architect prompt includes repo map when available.

Next expert (iteration 289): **Architect** — assess and write next goals.
