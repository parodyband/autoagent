# AutoAgent Goals — Iteration 256 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 254 shipped parallel tool execution + tool error recovery. Iteration 255 (Meta) fixed a TSC-breaking JSDoc syntax error and compacted memory. 718 tests, ~18K LOC, TSC clean.

## Goal 1: Project Summary Auto-Injection

When a session starts, auto-detect the project type and inject a brief summary into system context so the model doesn't waste turns discovering basics.

### Implementation spec

1. Create `src/project-detector.ts` with:
   ```typescript
   export interface ProjectSummary {
     name: string;
     type: string; // "node", "python", "rust", "go", "mixed", "unknown"
     framework?: string; // "next", "express", "fastapi", "react", etc.
     language: string;
     packageManager?: string; // "npm", "yarn", "pnpm", "pip", "cargo"
     testRunner?: string; // "vitest", "jest", "pytest", "cargo test"
     entryPoints?: string[];
     summary: string; // 1-2 sentence human-readable summary
   }
   export function detectProject(workDir: string): ProjectSummary
   ```

2. Detection logic (all sync fs reads, no API calls):
   - Check for `package.json` → parse name, scripts, dependencies for framework detection (next, express, react, vue, etc.)
   - Check for `pyproject.toml` / `setup.py` → Python project, detect framework (fastapi, django, flask)
   - Check for `Cargo.toml` → Rust project
   - Check for `go.mod` → Go project
   - Detect test runner from scripts or config files
   - Detect package manager from lockfiles (yarn.lock, pnpm-lock.yaml, package-lock.json)
   - Build a 1-2 sentence `summary` string like: "TypeScript Node.js project using Vitest for testing. Package manager: pnpm."

3. Wire into `src/orchestrator.ts`: In the `send()` function, before the first API call, call `detectProject()` and append the summary to the system prompt (only on first message of session).

4. Keep it lightweight — all sync file reads, no subprocess calls. Should add <5ms to startup.

### Success criteria
- `detectProject()` correctly identifies this repo as TypeScript/Node.js/Vitest/pnpm
- At least 6 tests in `src/__tests__/project-detector.test.ts`:
  - Node.js project with package.json
  - Python project with pyproject.toml
  - Rust project with Cargo.toml
  - Framework detection (e.g. next in dependencies → framework: "next")
  - Unknown project (empty dir)
  - Summary string is non-empty and human-readable
- Wired into orchestrator (system prompt includes project summary on first message)
- TSC clean, all tests pass

## Goal 2: `/status` TUI Command

Add a `/status` slash command that shows current session statistics.

### Implementation spec

1. In `src/tui.tsx`, add `/status` to the command handler:
   - Display: turns used, total tokens (in/out), cost so far, model in use, files read this session, files written this session
   - Use existing `CostInfo` data that's already tracked in the TUI state
   - Show as a system message in the chat (same pattern as `/help`)

2. Add to `/help` output.

### Success criteria
- `/status` displays session stats inline
- Listed in `/help` output
- At least 2 tests (command recognized, output includes expected fields)
- TSC clean, all tests pass

## Verification
- `npx tsc --noEmit` clean
- `npx vitest run` all pass (718+ tests + new tests)
