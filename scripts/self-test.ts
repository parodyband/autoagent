/**
 * AutoAgent Runtime Self-Test Suite
 *
 * Tests core tool modules to ensure they work correctly.
 * Run with: npx tsx scripts/self-test.ts
 * Exits 0 on success, 1 on failure.
 */

import { executeBash } from "../src/tools/bash.js";
import { executeReadFile } from "../src/tools/read_file.js";
import { executeWriteFile } from "../src/tools/write_file.js";
import { executeGrep } from "../src/tools/grep.js";
import { executeThink } from "../src/tools/think.js";
import { executeListFiles } from "../src/tools/list_files.js";
import { compactMemory } from "./compact-memory.js";
import { generateDashboard } from "./dashboard.js";
import { existsSync, unlinkSync, rmSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const TEMP_DIR = path.join(ROOT, ".self-test-tmp");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ ${testName}${detail ? ": " + detail : ""}`);
  }
}

// ─── Bash Tests ─────────────────────────────────────────────

async function testBash(): Promise<void> {
  console.log("\n🔧 Bash Tool");

  // Basic execution
  const echo = await executeBash("echo hello", 10, ROOT);
  assert(echo.exitCode === 0 && echo.output.trim() === "hello", "bash: echo works");

  // Exit codes
  const fail = await executeBash("exit 42", 10, ROOT);
  assert(fail.exitCode === 42, "bash: non-zero exit code propagated", `got ${fail.exitCode}`);

  // Blocked commands
  const blocked = await executeBash("git push origin main", 10, ROOT);
  assert(blocked.exitCode === -1 && blocked.output.includes("BLOCKED"), "bash: destructive git blocked");

  // Timeout (should complete quickly — just verify it doesn't hang)
  const quick = await executeBash("sleep 0.1 && echo done", 5, ROOT);
  assert(quick.exitCode === 0 && quick.output.trim() === "done", "bash: timeout doesn't kill fast commands");

  // Multi-line output
  const multi = await executeBash("echo 'line1\nline2\nline3'", 10, ROOT);
  assert(multi.exitCode === 0 && multi.output.includes("line2"), "bash: multi-line output");
}

// ─── Read File Tests ────────────────────────────────────────

function testReadFile(): void {
  console.log("\n📖 Read File Tool");

  // Read existing file
  const pkg = executeReadFile("package.json", undefined, undefined, ROOT);
  assert(pkg.success && pkg.content.includes("autoagent"), "read_file: reads package.json");

  // Missing file
  const missing = executeReadFile("nonexistent-file-12345.txt", undefined, undefined, ROOT);
  assert(!missing.success && missing.content.includes("ERROR"), "read_file: missing file returns error");

  // Directory path
  const dir = executeReadFile("src", undefined, undefined, ROOT);
  assert(!dir.success && dir.content.includes("directory"), "read_file: directory returns error");

  // Line range
  const lines = executeReadFile("package.json", 1, 3, ROOT);
  assert(lines.success, "read_file: line range works");
  const lineCount = lines.content.split("\n").length;
  assert(lineCount <= 3, "read_file: line range limits output", `got ${lineCount} lines`);
}

// ─── Write File Tests ───────────────────────────────────────

function testWriteFile(): void {
  console.log("\n✏️  Write File Tool");

  // Create new file
  const testFile = path.join(TEMP_DIR, "test-write.txt");
  const relPath = path.relative(ROOT, testFile);
  const create = executeWriteFile(relPath, "hello world", "write", ROOT);
  assert(create.success && existsSync(testFile), "write_file: creates new file");

  // Read it back
  const readBack = executeReadFile(relPath, undefined, undefined, ROOT);
  assert(readBack.success && readBack.content === "hello world", "write_file: content matches");

  // Append
  const append = executeWriteFile(relPath, "\nappended", "append", ROOT);
  assert(append.success, "write_file: append succeeds");
  const afterAppend = executeReadFile(relPath, undefined, undefined, ROOT);
  assert(afterAppend.content === "hello world\nappended", "write_file: append content correct");

  // Patch mode
  const patch = executeWriteFile(relPath, "", "patch", ROOT, "hello", "goodbye");
  assert(patch.success, "write_file: patch succeeds");
  const afterPatch = executeReadFile(relPath, undefined, undefined, ROOT);
  assert(afterPatch.content === "goodbye world\nappended", "write_file: patch content correct");

  // Patch with missing old_string
  const badPatch = executeWriteFile(relPath, "", "patch", ROOT, "NOTFOUND", "replacement");
  assert(!badPatch.success && badPatch.message.includes("not found"), "write_file: patch with bad old_string fails");

  // Patch without old_string parameter
  const noPatch = executeWriteFile(relPath, "", "patch", ROOT);
  assert(!noPatch.success && noPatch.message.includes("requires"), "write_file: patch without old_string fails");

  // Patch non-existent file
  const patchMissing = executeWriteFile(".self-test-tmp/nonexistent.txt", "", "patch", ROOT, "a", "b");
  assert(!patchMissing.success, "write_file: patch non-existent file fails");

  // Nested directory creation
  const nestedPath = ".self-test-tmp/deep/nested/dir/file.txt";
  const nested = executeWriteFile(nestedPath, "nested content", "write", ROOT);
  assert(nested.success && existsSync(path.join(ROOT, nestedPath)), "write_file: creates nested directories");
}

// ─── Grep Tests ─────────────────────────────────────────────

function testGrep(): void {
  console.log("\n🔍 Grep Tool");

  // Basic search
  const result = executeGrep("executeBash", "src/tools/bash.ts", undefined, undefined, "content", 0, false, 100, false, ROOT);
  assert(result.success && result.matchCount > 0, "grep: finds function in file");

  // No results
  const noMatch = executeGrep("ZZZZNOTFOUND12345", "src/", undefined, undefined, "content", 0, false, 100, false, ROOT);
  assert(noMatch.matchCount === 0, "grep: no false positives");

  // File mode
  const files = executeGrep("executeBash", "src/", undefined, undefined, "files", 0, false, 100, false, ROOT);
  assert(files.success && files.content.includes("bash.ts"), "grep: file mode returns filenames");

  // Case insensitive
  const ci = executeGrep("EXECUTEBASH", "src/tools/bash.ts", undefined, undefined, "content", 0, true, 100, false, ROOT);
  assert(ci.success && ci.matchCount > 0, "grep: case insensitive works");
}

// ─── Think Tests ────────────────────────────────────────────

function testThink(): void {
  console.log("\n🧠 Think Tool");

  const result = executeThink("This is a test thought");
  assert(result.success, "think: returns success");
  assert(result.content.includes("22"), "think: reports correct char count");
}

// ─── List Files Tests ───────────────────────────────────────

function testListFiles(): void {
  console.log("\n📂 List Files Tool");

  // Setup test directory structure
  const testDir = path.join(TEMP_DIR, "list-test");
  mkdirSync(path.join(testDir, "subdir"), { recursive: true });
  writeFileSync(path.join(testDir, "file1.txt"), "hello");
  writeFileSync(path.join(testDir, "file2.ts"), "export default 42;");
  writeFileSync(path.join(testDir, "subdir", "nested.md"), "# Nested");

  const relDir = path.relative(ROOT, testDir);

  // Basic listing
  const result = executeListFiles(relDir, 3, [], ROOT);
  assert(result.success, "list_files: lists test directory");
  assert(result.fileCount === 3, "list_files: correct file count", `got ${result.fileCount}`);
  assert(result.dirCount === 1, "list_files: correct dir count", `got ${result.dirCount}`);
  assert(result.content.includes("file1.txt"), "list_files: contains file1.txt");
  assert(result.content.includes("nested.md"), "list_files: contains nested file");

  // Depth limiting
  const shallow = executeListFiles(relDir, 1, [], ROOT);
  assert(shallow.success, "list_files: shallow listing works");
  assert(shallow.content.includes("[...]"), "list_files: shows [...] for depth-limited dirs");

  // Exclusion
  mkdirSync(path.join(testDir, "node_modules"), { recursive: true });
  writeFileSync(path.join(testDir, "node_modules", "pkg.js"), "module");
  const excluded = executeListFiles(relDir, 3, ["node_modules"], ROOT);
  assert(!excluded.content.includes("pkg.js"), "list_files: excludes node_modules");

  // Non-existent directory
  const missing = executeListFiles(".self-test-tmp/nonexistent", 3, [], ROOT);
  assert(!missing.success && missing.content.includes("ERROR"), "list_files: missing dir returns error");

  // File path (not directory)
  const filePath = path.relative(ROOT, path.join(testDir, "file1.txt"));
  const notDir = executeListFiles(filePath, 3, [], ROOT);
  assert(!notDir.success && notDir.content.includes("not a directory"), "list_files: file path returns error");

  // Project root listing (smoke test)
  const rootList = executeListFiles(".", 1, ["node_modules", ".git", "dist", ".self-test-tmp"], ROOT);
  assert(rootList.success && rootList.fileCount > 0, "list_files: project root works");
}

// ─── Import Verification ────────────────────────────────────

function testImports(): void {
  console.log("\n📦 Module Imports");

  // Verify all tool functions are properly imported
  assert(typeof executeBash === "function", "import: executeBash is a function");
  assert(typeof executeReadFile === "function", "import: executeReadFile is a function");
  assert(typeof executeWriteFile === "function", "import: executeWriteFile is a function");
  assert(typeof executeGrep === "function", "import: executeGrep is a function");
  assert(typeof executeThink === "function", "import: executeThink is a function");
  assert(typeof executeListFiles === "function", "import: executeListFiles is a function");
}

// ─── Memory Compaction ──────────────────────────────────────

function testCompactMemory(): void {
  console.log("\n📦 Memory Compaction");

  // Short content — no compaction
  const short = "# Memory\n\nShort content.";
  const r1 = compactMemory(short);
  assert(!r1.wasCompacted, "No compaction for short content");
  assert(r1.compacted === short, "Short content unchanged");

  // Long content — should compact (need >6000 chars)
  const sections: string[] = ["# AutoAgent Memory\n\nPreamble text.\n\n---\n"];
  const filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10);
  for (let i = 0; i < 8; i++) {
    sections.push(
      `## Iteration ${i} — Test (2026-01-01)\n\n` +
      `### What I Built\n- Built thing ${i}\n- Also built another thing\n- ${filler}\n\n` +
      `### Key Insights\n1. **Insight A** — ${filler}\n2. **Insight B** — another explanation\n\n` +
      `### Ideas\n- Idea one ${filler}\n- Idea two\n\n---\n`
    );
  }
  const long = sections.join("\n");
  assert(long.length > 6000, `Long content is over threshold (${long.length} chars)`);

  const r2 = compactMemory(long);
  assert(r2.wasCompacted, "Long content was compacted");
  assert(r2.compacted.length < long.length, `Compacted is shorter (${r2.compacted.length} < ${long.length})`);
  assert(r2.saved > 0, `Saved ${r2.saved} chars`);

  // Should keep last 2 entries in full
  assert(r2.compacted.includes("## Iteration 6"), "Keeps 2nd-to-last entry header");
  assert(r2.compacted.includes("## Iteration 7"), "Keeps last entry header");
  assert(r2.compacted.includes("Compacted History"), "Has compacted history section");

  // Compacted entries should not have full subsection headers
  assert(!r2.compacted.includes("## Iteration 0 —"), "Iter 0 is compacted (no full header)");

  // Test structured memory format
  const structuredMemory = [
    "# AutoAgent Memory\n\nPreamble.\n\n---\n",
    "## Architecture\n\nStable facts about the codebase.\n- Fact one\n- Fact two\n\n---\n",
    "## Session Log\n\nPer-iteration entries.\n",
  ].join("\n");

  // Build a long structured memory that exceeds threshold
  const filler2 = "Detailed explanation of what happened in this iteration. ".repeat(15);
  let longStructured = structuredMemory;
  for (let i = 0; i < 6; i++) {
    longStructured += `\n### Iteration ${i} — Test (2026-01-01)\n\n`;
    longStructured += `#### What I Built\n- Built thing ${i}\n- ${filler2}\n\n`;
    longStructured += `#### Key Insights\n1. Insight A\n2. Insight B\n\n---\n`;
  }
  assert(longStructured.length > 6000, `Structured memory over threshold (${longStructured.length})`);

  const r3 = compactMemory(longStructured);
  assert(r3.wasCompacted, "Structured memory was compacted");
  assert(r3.compacted.includes("## Architecture"), "Architecture section preserved");
  assert(r3.compacted.includes("Stable facts"), "Architecture content preserved");
  assert(r3.compacted.includes("## Session Log"), "Session Log header preserved");
  assert(r3.compacted.includes("### Iteration 4"), "Keeps 2nd-to-last structured entry");
  assert(r3.compacted.includes("### Iteration 5"), "Keeps last structured entry");
  assert(r3.compacted.includes("Compacted History"), "Has compacted history in structured format");

  // Short structured memory — no compaction
  const r4 = compactMemory(structuredMemory);
  assert(!r4.wasCompacted, "Short structured memory not compacted");
}

// ─── Dashboard Tests ────────────────────────────────────────

function testDashboard(): void {
  console.log("\n📊 Dashboard");

  // Generate from sample metrics
  const sampleMetrics = [
    {
      iteration: 0, startTime: "2026-01-01T00:00:00Z", endTime: "2026-01-01T00:01:00Z",
      turns: 10, toolCalls: { bash: 5, read_file: 3 }, success: true,
      durationMs: 60000, inputTokens: 100000, outputTokens: 5000,
    },
    {
      iteration: 1, startTime: "2026-01-01T00:01:00Z", endTime: "2026-01-01T00:03:00Z",
      turns: 20, toolCalls: { bash: 8, write_file: 6, think: 2 }, success: true,
      durationMs: 120000, inputTokens: 200000, outputTokens: 8000,
      cacheCreationTokens: 5000, cacheReadTokens: 15000,
    },
  ];

  const html = generateDashboard(sampleMetrics);
  assert(html.includes("<!DOCTYPE html>"), "dashboard: valid HTML");
  assert(html.includes("AutoAgent Dashboard"), "dashboard: has title");
  assert(html.includes("Iteration"), "dashboard: has iteration column");
  assert(html.includes("100.0K"), "dashboard: formats token numbers");
  assert(html.includes("1m 0s") || html.includes("1m"), "dashboard: formats duration");
  assert(html.includes("bash("), "dashboard: shows top tools");
  assert(html.includes("Total"), "dashboard: has summary row");
  assert(html.includes("Avg"), "dashboard: has average row");

  // Empty metrics
  const emptyHtml = generateDashboard([]);
  assert(emptyHtml.includes("<!DOCTYPE html>"), "dashboard: handles empty metrics");
  assert(emptyHtml.includes("0"), "dashboard: shows zero for empty");
}

// ─── Main ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const start = Date.now();
  console.log("🧪 AutoAgent Self-Test Suite\n" + "=".repeat(40));

  // Setup temp directory
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true });
  }

  try {
    testImports();
    await testBash();
    testReadFile();
    testWriteFile();
    testGrep();
    testThink();
    testListFiles();
    testCompactMemory();
    testDashboard();
  } finally {
    // Cleanup
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed (${duration}s)`);

  if (failed > 0) {
    console.error("\n💥 SELF-TEST FAILED — Do not commit!");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Self-test crashed:", err);
  process.exit(1);
});
