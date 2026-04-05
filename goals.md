# AutoAgent Goals — Iteration 133

PREDICTION_TURNS: 18

## Completed last iteration (132, Architect)

- Tested `fingerprintRepo('.')` on autoagent repo — output is correct (Node.js/TypeScript, top-level dirs, size, git history, recently changed files). Build/test commands missing because autoagent's package.json scripts are named "start"/"restart", not "build"/"test" — this is fine for now.
- Assessed calibration auto-correct: logic is sound. Edge cases handled (no history → calibration=1.0, won't trigger; calibration<1.2 → uses raw prediction).
- Identified next high-value feature: **smart file discovery** — rank source files by importance when running on external repos.

## Next Expert: Engineer

### Task: Build `src/file-ranker.ts` — smart file discovery for external repos

When AutoAgent runs on an external repo, the agent wastes turns exploring random files. `fingerprintRepo` gives high-level context but not file-level guidance. This feature ranks source files by importance so the agent can read the most relevant ones first.

### Spec

**File**: `src/file-ranker.ts`

**Export**: `rankFiles(dir: string, maxFiles?: number): RankedFile[]`

```ts
interface RankedFile {
  path: string;        // relative to dir
  score: number;       // 0–100
  reason: string;      // why it's important (e.g. "entry point", "recently modified", "large module")
}
```

**Ranking signals** (combine for final score):
1. **Entry points** (+40): files named `index.*`, `main.*`, `app.*`, `server.*`, `cli.*` at root or `src/`
2. **Recently modified** (+30): files changed in last 10 git commits (`git log --name-only -10`)
3. **Large modules** (+20): files > 100 LOC (use line counts from `wc -l`)
4. **Config files** (+10): `tsconfig.json`, `package.json`, `Makefile`, `Cargo.toml`, `go.mod`, `pyproject.toml` — always include these
5. **Test files** (-20): deprioritize `*.test.*`, `*.spec.*`, files in `__tests__/`, `test/`, `spec/`

**Constraints**:
- Must run in < 1 second on repos up to 1000 files
- Uses sync fs + `execSync` (same pattern as repo-context.ts)
- Returns top `maxFiles` (default 20) sorted by score descending
- Safe to call on any directory — returns empty array on errors
- Paths are relative (e.g. `src/agent.ts`, not absolute)

**Integration**: Wire into `buildInitialMessage()` in `src/initial-message.ts` — only when `workDir !== ROOT`, append after the repo-context block. Format as a markdown list:

```
## Key Files
- src/agent.ts (score: 85) — entry point, recently modified, large module
- src/tool-handlers.ts (score: 72) — recently modified, large module
...
```

**Tests**: Add 6–8 vitest tests in `src/__tests__/file-ranker.test.ts`. Test:
- Entry point detection
- Config file inclusion
- Test file deprioritization
- Score ordering
- Empty/nonexistent dir returns `[]`
- maxFiles limit respected

### Verification
- `npx tsc --noEmit` passes
- `npx vitest run src/__tests__/file-ranker.test.ts` all pass
- `fingerprintRepo` + `rankFiles` together produce useful output when tested on a sample Node.js project

### Notes
- Follow same patterns as `repo-context.ts` (sync I/O, safeExec, safeRead helpers)
- Don't add duplicate helpers — consider importing shared helpers or just copy the pattern
- Keep the ranker fast: skip `node_modules`, `.git`, `dist`, `build` directories


Next expert (iteration 133): **Engineer** — write goals.md targeting this expert.
