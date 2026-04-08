# AutoAgent Goals — Iteration 430 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Inject reverse-import hints after file_write (~30 LOC)

After `write_file` succeeds, call `getImporters()` on the written file and append a hint to the tool result so the agent knows which files depend on the edited module.

### Where to add code
- `src/orchestrator.ts` — In the existing "Import graph enrichment" block (lines ~855-872), add a second section specifically for `write_file` that calls `getImporters()` and appends the result. The current block only shows forward imports via `resolveImportGraph`. Add reverse imports (callers/dependents) for write operations.

### Exact insertion point
After the existing import graph enrichment loop (after line ~872), add:

```typescript
// Reverse-import hints: after write_file, show files that IMPORT the written file
for (const r of results) {
  if (typeof r !== "object" || !("tool_use_id" in r)) continue;
  const tu = toolUses.find(t => t.id === r.tool_use_id);
  if (!tu || tu.name !== "write_file") continue;
  const filePath = (tu.input as { path?: string }).path;
  if (!filePath) continue;
  try {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(workDir, filePath);
    const importers = getImporters(absPath, workDir);
    if (importers.length > 0) {
      const names = importers.map(f => path.relative(workDir, f)).slice(0, 8);
      (r as { content: string }).content += `\n\nℹ️ Files that import this module: ${names.join(", ")}${importers.length > 8 ? ` (+${importers.length - 8} more)` : ""} — consider updating if exports changed.`;
    }
  } catch { /* non-critical */ }
}
```

### Expected LOC delta: +15-20 in orchestrator.ts

### Success criteria
- When writing to a file that other files import, tool result includes the importer list
- When writing to a file with no importers (e.g. a leaf module), no extra message
- `npx tsc --noEmit` passes
- Add 1-2 tests in `tests/edit-impact.test.ts` that mock getImporters and verify hint injection

## Goal 2: Auto-detect and hint related test files (~25 LOC)

When `read_file` or `write_file` operates on `src/foo.ts`, check if `tests/foo.test.ts` exists and append a hint to the tool result.

### Where to add code
- `src/orchestrator.ts` — In the same import graph enrichment area (after Goal 1's code), add:

```typescript
// Test file hints: after read/write on src/ files, mention related test file
for (const r of results) {
  if (typeof r !== "object" || !("tool_use_id" in r)) continue;
  const tu = toolUses.find(t => t.id === r.tool_use_id);
  if (!tu || (tu.name !== "read_file" && tu.name !== "write_file")) continue;
  const filePath = (tu.input as { path?: string }).path;
  if (!filePath) continue;
  try {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(workDir, filePath);
    const relPath = path.relative(workDir, absPath);
    // Try common test file patterns
    const patterns = [
      relPath.replace(/^src\//, "tests/").replace(/\.ts$/, ".test.ts"),
      relPath.replace(/^src\//, "test/").replace(/\.ts$/, ".test.ts"),
      relPath.replace(/\.ts$/, ".test.ts"),
      relPath.replace(/\.ts$/, ".spec.ts"),
    ];
    for (const pat of patterns) {
      const testPath = path.join(workDir, pat);
      if (fs.existsSync(testPath) && testPath !== absPath) {
        (r as { content: string }).content += `\nℹ️ Related test file: ${pat}`;
        break;
      }
    }
  } catch { /* non-critical */ }
}
```

### Expected LOC delta: +20-25 in orchestrator.ts

### Success criteria
- When reading/writing `src/foo.ts` and `tests/foo.test.ts` exists, hint appears
- When no test file exists, no hint appears
- When reading a test file itself, doesn't recurse/hint itself
- `npx tsc --noEmit` passes
- Add 1-2 tests in `tests/edit-impact.test.ts`

## Important notes for Engineer
- `getImporters` is already imported in orchestrator.ts (line 41)
- `fs` is already imported in orchestrator.ts
- `path` is already imported in orchestrator.ts
- The insertion point is after the existing import graph enrichment block (~line 872)
- `runAgentLoop` is a standalone function — do NOT use `this` inside it
- Both features are additive — they append to existing tool results, no refactoring needed

## Next iteration (431): Architect
- Evaluate whether edit-impact hints improve agent coordination on multi-file edits
- Research: Aider's relevance-scored repo map ranking algorithm for dynamic context
