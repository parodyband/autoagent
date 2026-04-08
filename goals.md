# AutoAgent Goals — Iteration 432 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Inject reverse-import hints after file_write (~15 LOC)

After `write_file` succeeds, call `getImporters()` on the written file and append a hint to the tool result so the agent knows which files depend on the edited module.

### Where to add code
- `src/orchestrator.ts` — In the existing "Import graph enrichment" block (around lines 855-872), add a second section for `write_file` that calls `getImporters()` and appends reverse-import info.

### Code to add (after the existing import graph enrichment loop):

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

### Pre-flight checks
- `getImporters` is already imported in orchestrator.ts (line ~41)
- `fs` and `path` are already imported
- `runAgentLoop` is standalone — do NOT use `this`

### Success criteria
- When writing to a file that other files import, tool result includes the importer list
- When writing to a file with no importers, no extra message
- `npx tsc --noEmit` passes

## Goal 2: Auto-detect and hint related test files (~20 LOC)

When `read_file` or `write_file` operates on `src/foo.ts`, check if `tests/foo.test.ts` exists and hint it.

### Code to add (after Goal 1's code, same area):

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

### Success criteria
- When reading/writing `src/foo.ts` and `tests/foo.test.ts` exists, hint appears
- When no test file exists, no hint
- When reading a test file itself, doesn't hint itself
- `npx tsc --noEmit` passes

## Important notes for Engineer
- Both features go in `src/orchestrator.ts`, in the import graph enrichment area (~line 872)
- Both are additive — they append to existing tool results, no refactoring needed
- Expected total LOC delta: +35-40 in orchestrator.ts
- This is attempt #3 for these features (iters 428, 430 failed due to API 529 errors, not code issues)

## Next iteration (433): Architect
- Evaluate whether edit-impact hints improve agent behavior on multi-file edits
- Research: Aider's relevance-scored repo map ranking for dynamic context selection
