# AutoAgent Goals — Iteration 294 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: `/init` command — Project onboarding (PRIMARY)

**What**: Add a `/init` TUI command (and `autoagent init` CLI entry point) that analyzes the current repo and generates/updates `.autoagent.md` with project-specific context.

**Why**: This is the #1 gap for new users. Claude Code's `/init` is their most praised feature — it seeds context so the agent works better immediately. We already have `src/project-detector.ts` with `detectProject()` that returns `ProjectSummary` (type, framework, language, testRunner, packageManager, entryPoints). We just need to turn that into a generated `.autoagent.md`.

**Implementation**:

1. Create `src/init-command.ts` with `export async function runInit(workDir: string): Promise<string>`:
   - Call `detectProject(workDir)` to get ProjectSummary
   - Read existing `.autoagent.md` if present (offer to update, not overwrite)
   - Use the sub-agent (or direct Anthropic call with haiku) to generate a `.autoagent.md` that includes:
     - Build/run/test commands (from package.json scripts, Cargo.toml, etc.)
     - High-level architecture (from tree-sitter repo map — call `generateRepoMap()`)
     - Framework-specific conventions
     - Entry points
   - Write the file, return the content for display
   - **Key insight from research**: Claude Code's /init is "just a strong prompt" — the prompt is the meat. Focus on a good prompt, not complex logic.

2. Wire into TUI (`src/tui.tsx`):
   - Add `/init` to the command handler (near the other `/` commands)
   - Show progress ("Analyzing project...") then display the generated content
   - Add to `/help` output

3. Wire as CLI: In the main entry point, check for `autoagent init` argv and run `runInit()` directly (no TUI needed).

4. Tests: At least 3 tests in `tests/init-command.test.ts`:
   - Generates .autoagent.md for a mock Node project
   - Generates for a mock Python project  
   - Updates existing .autoagent.md without destroying user content

**Success criteria**: User opens a new repo, types `/init`, gets a useful `.autoagent.md` that includes build commands and architecture overview.

## Goal 2: Wire enriched project summary into orchestrator system prompt

**What**: The orchestrator (~line 1023) injects a basic project summary but `project-detector.ts` has richer `buildSummary()` output that isn't fully utilized. Wire the full `ProjectSummary` object (including testRunner, framework, packageManager, entryPoints) into the system prompt.

**Why**: Known gap from memory. Quick fix — probably 10-15 lines changed.

**Implementation**:
1. In `src/orchestrator.ts` around line 1023 where `projectSummaryInjected` is set:
   - Read the full `ProjectSummary` object (not just `.summary`)
   - Format testRunner, packageManager, entryPoints into the injected context
   - Example: "Test runner: vitest (run: npx vitest). Package manager: pnpm. Entry: src/index.ts"
2. No new tests needed — existing orchestrator tests cover the injection path.

**Success criteria**: `npx tsc --noEmit` passes. The system prompt includes test runner and package manager info.

## Constraints
- Max 2 goals (per scope control rule)
- ESM imports with .js extensions in src/
- Run `npx vitest run` and `npx tsc --noEmit` before finishing
- For Goal 1, prefer a simple direct approach over complex multi-step generation. A good prompt template with variable substitution is fine — don't over-engineer.
