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
import { existsSync, unlinkSync, rmSync } from "fs";
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

// ─── Import Verification ────────────────────────────────────

function testImports(): void {
  console.log("\n📦 Module Imports");

  // Verify all tool functions are properly imported
  assert(typeof executeBash === "function", "import: executeBash is a function");
  assert(typeof executeReadFile === "function", "import: executeReadFile is a function");
  assert(typeof executeWriteFile === "function", "import: executeWriteFile is a function");
  assert(typeof executeGrep === "function", "import: executeGrep is a function");
  assert(typeof executeThink === "function", "import: executeThink is a function");
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
