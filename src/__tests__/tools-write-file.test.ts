import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeWriteFile, isAppendOnly } from "../tools/write_file.js";
import { readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import os from "os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `autoagent-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("executeWriteFile", () => {
  it("creates a new file with write mode", () => {
    const result = executeWriteFile("test.txt", "hello world", "write", tmpDir);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Created");
    expect(readFileSync(path.join(tmpDir, "test.txt"), "utf-8")).toBe("hello world");
  });

  it("overwrites existing file in write mode", () => {
    executeWriteFile("test.txt", "original", "write", tmpDir);
    const result = executeWriteFile("test.txt", "updated", "write", tmpDir);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Updated");
    expect(readFileSync(path.join(tmpDir, "test.txt"), "utf-8")).toBe("updated");
  });

  it("appends to an existing file", () => {
    executeWriteFile("test.txt", "line1\n", "write", tmpDir);
    const result = executeWriteFile("test.txt", "line2\n", "append", tmpDir);
    expect(result.success).toBe(true);
    expect(readFileSync(path.join(tmpDir, "test.txt"), "utf-8")).toBe("line1\nline2\n");
  });

  it("creates parent directories automatically", () => {
    const result = executeWriteFile("a/b/c/test.txt", "nested", "write", tmpDir);
    expect(result.success).toBe(true);
    expect(existsSync(path.join(tmpDir, "a/b/c/test.txt"))).toBe(true);
  });

  it("patch mode replaces old_string with new_string", () => {
    executeWriteFile("test.txt", "foo bar baz", "write", tmpDir);
    const result = executeWriteFile("test.txt", "", "patch", tmpDir, "bar", "QUX");
    expect(result.success).toBe(true);
    expect(readFileSync(path.join(tmpDir, "test.txt"), "utf-8")).toBe("foo QUX baz");
    expect(result.message).toContain("Patched");
  });

  it("patch mode fails if old_string not found", () => {
    executeWriteFile("test.txt", "hello world", "write", tmpDir);
    const result = executeWriteFile("test.txt", "", "patch", tmpDir, "NOTHERE", "replacement");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("patch mode fails on non-existent file", () => {
    const result = executeWriteFile("nonexistent.txt", "", "patch", tmpDir, "old", "new");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot patch non-existent");
  });

  it("patch mode requires old_string", () => {
    executeWriteFile("test.txt", "content", "write", tmpDir);
    const result = executeWriteFile("test.txt", "", "patch", tmpDir, undefined, "new");
    expect(result.success).toBe(false);
    expect(result.message).toContain("old_string");
  });
});

describe("stale-file warning", () => {
  // We need to import globalMtimeTracker to manipulate it in tests
  // But since it's a singleton, we simulate read→external-modify→write

  it("shows ⚠ warning when file was read then externally modified", async () => {
    const { globalMtimeTracker } = await import("../file-cache.js");
    const filePath = path.join(tmpDir, "stale.txt");
    // Create file
    executeWriteFile("stale.txt", "original", "write", tmpDir);
    // Simulate: we "read" it by recording an old mtime
    const { statSync } = await import("fs");
    const mtime = statSync(filePath).mtimeMs;
    globalMtimeTracker.record(filePath, mtime - 1000); // recorded older than actual
    // Now write — should see stale warning
    const result = executeWriteFile("stale.txt", "new content", "write", tmpDir);
    expect(result.success).toBe(true);
    expect(result.message).toContain("⚠");
    globalMtimeTracker.delete(filePath);
  });

  it("no warning when file was read and NOT externally modified", async () => {
    const { globalMtimeTracker } = await import("../file-cache.js");
    const filePath = path.join(tmpDir, "fresh.txt");
    executeWriteFile("fresh.txt", "original", "write", tmpDir);
    const { statSync } = await import("fs");
    const mtime = statSync(filePath).mtimeMs;
    globalMtimeTracker.record(filePath, mtime); // exact mtime — not stale
    const result = executeWriteFile("fresh.txt", "new content", "write", tmpDir);
    expect(result.success).toBe(true);
    expect(result.message).not.toContain("⚠");
    globalMtimeTracker.delete(filePath);
  });

  it("no warning for files never read", () => {
    executeWriteFile("never-read.txt", "original", "write", tmpDir);
    const result = executeWriteFile("never-read.txt", "new content", "write", tmpDir);
    expect(result.success).toBe(true);
    expect(result.message).not.toContain("⚠");
  });

  it("patch mode clears tracker — no false warning on subsequent write", async () => {
    const { globalMtimeTracker } = await import("../file-cache.js");
    const filePath = path.join(tmpDir, "patch-stale.txt");
    executeWriteFile("patch-stale.txt", "hello world", "write", tmpDir);
    const { statSync } = await import("fs");
    // Record a stale mtime (old read time)
    globalMtimeTracker.record(filePath, statSync(filePath).mtimeMs - 1000);
    // Patch it — this should clear the tracker
    const patchResult = executeWriteFile("patch-stale.txt", "", "patch", tmpDir, "world", "earth");
    expect(patchResult.success).toBe(true);
    // Now write again — tracker was cleared by patch, so no stale warning
    const writeResult = executeWriteFile("patch-stale.txt", "brand new", "write", tmpDir);
    expect(writeResult.success).toBe(true);
    expect(writeResult.message).not.toContain("⚠");
    globalMtimeTracker.delete(filePath);
  });
});

describe("isAppendOnly", () => {
  it("memory.md is append-only", () => {
    expect(isAppendOnly("memory.md")).toBe(true);
  });

  it("agentlog.md is append-only", () => {
    expect(isAppendOnly("agentlog.md")).toBe(true);
  });

  it("regular files are not append-only", () => {
    expect(isAppendOnly("src/tools/bash.ts")).toBe(false);
    expect(isAppendOnly("goals.md")).toBe(false);
    expect(isAppendOnly("README.md")).toBe(false);
  });
});
