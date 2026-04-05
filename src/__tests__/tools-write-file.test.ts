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
