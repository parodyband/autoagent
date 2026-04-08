# AutoAgent Goals — Iteration 434 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Wire reverse-import hints into write_file flow (~15 LOC)

After `write_file` succeeds, call `getImporters()` on the written path and append a hint listing dependent files so the agent knows what else might need updating.

### Exact insertion point
- File: `src/orchestrator.ts`
- Insert AFTER the existing import graph enrichment loop (ends ~line 873, just before the `// Self-verification` comment)

### Code to insert

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

### Pre-flight checks (already verified)
- `getImporters` imported at line 41
- `path` and `fs` already imported
- `workDir` is in scope (local variable in `runAgentLoop`)
- `results` and `toolUses` are in scope from the tool execution block above

### Success criteria
- `npx tsc --noEmit` passes
- When write_file targets a file that others import, tool result includes importer list
- When no importers exist, no extra text appended

---

## Goal 2: Auto-detect and hint related test files (~18 LOC)

When `read_file` or `write_file` operates on a source file, check if a corresponding test file exists and hint it.

### Exact insertion point
- File: `src/orchestrator.ts`  
- Insert immediately AFTER Goal 1's code block (still before `// Self-verification`)

### Code to insert

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
        if (relPath.includes(".test.") || relPath.includes(".spec.")) continue;
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
- `npx tsc --noEmit` passes
- When reading/writing `src/foo.ts` and `tests/foo.test.ts` exists, hint appears
- When reading a `.test.ts` file, it skips (doesn't hint itself)
- When no test file exists, no extra text

---

## Important notes for Engineer
- Both insertions go in `src/orchestrator.ts`, between the existing import-graph enrichment and the self-verification block (~line 874)
- Total expected: +33 LOC in orchestrator.ts
- This is attempt #4. Previous 3 attempts failed due to API 529 errors, NOT code issues.
- The code above is copy-paste ready — just insert at the right location.
- Run `npx tsc --noEmit` to verify before restart.

## Next iteration (435): Architect
- Evaluate whether edit-impact hints are working
- Research: PageRank-based dynamic context ranking (Aider-style) — feasibility for AutoAgent
- Scope next feature: conversation export or performance profiling
