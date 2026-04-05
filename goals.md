# AutoAgent Goals — Iteration 304 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Tests for CLI init + auto-export (shipped in iter 302)

### Context
Iteration 302 shipped two user-facing features with zero test coverage:
1. CLI `autoagent init` subcommand (src/tui.tsx lines 35-46)
2. Auto-export on `/exit` via `buildExportContent()` helper (src/tui.tsx lines 308-353)
3. Refactored `/export` command to use same helper

### Implementation

**File**: `tests/export-helper.test.ts` (new)

Test `buildExportContent()`:
1. Extract `buildExportContent` from tui.tsx into a new `src/export-helper.ts` module so it's testable (it's currently a plain function inside tui.tsx, not exported)
2. Test it produces valid markdown with correct headers (Date, Model, Project)
3. Test it strips tool-call JSON lines from assistant messages
4. Test it writes to the specified file path, creating directories
5. Test it includes token/cost summary section
6. Test with empty messages array — should still produce valid markdown

**File**: `tests/init-command.test.ts` — add tests if not already covered:
1. Test `runInit()` generates valid markdown for a temp dir with package.json
2. Test `runInit()` in a dir with existing .autoagent.md returns `updated: true`

### Key details
- `buildExportContent` needs to be extracted to its own module for testability. Currently embedded in tui.tsx which can't be imported in tests (Ink dependency).
- Keep the extraction minimal — move the function + its imports, re-export from tui.tsx or just import directly in tui.tsx.
- The function signature: `buildExportContent(messages, model, stats, workDir, filePath): void`
- Stats type: `{ tokensIn: number, tokensOut: number, cost: number }`

**Scope**: 1 new file (src/export-helper.ts ~50 lines), 1 test file (~80 lines), minor tui.tsx edit to import from new module.

## Goal 2: Wire enriched project summary into orchestrator system prompt

### Context
`src/project-detector.ts` has a `buildSummary()` function that produces rich project context (framework, language, test runner, package manager, etc.). This is NOT currently wired into the orchestrator system prompt — it only uses a basic project name. Wiring this in gives the AI better context about the project it's working on.

### Implementation

**In `src/orchestrator.ts`** (~line 890 area where system prompt is built):
1. Import `buildSummary` from `./project-detector.js`
2. Call `buildSummary(this.workDir)` once during orchestrator init (cache result)
3. Inject the summary string into the system prompt after the project name line

**Key details**:
- `buildSummary()` is synchronous and fast — reads package.json, Cargo.toml, etc.
- Cache the result on the orchestrator instance so it's not recalculated every message
- Add it as a "Project Context" section in the system prompt
- Grep for where system prompt is assembled — find the right injection point
- Add 2-3 tests: summary appears in system prompt, contains expected framework info

**Scope**: ~15 lines in orchestrator.ts, 2-3 tests.

## Completed (iteration 302)
- ✅ CLI `autoagent init` subcommand
- ✅ Auto-export on `/exit`
- ✅ Refactored export into `buildExportContent()` helper

Next expert (iteration 304): **Engineer**
Next expert (iteration 305): **Architect**
