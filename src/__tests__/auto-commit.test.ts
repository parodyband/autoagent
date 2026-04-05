import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { autoCommit, undoLastCommit } from "../auto-commit.js";

// ─── Helpers ───────────────────────────────────────────────────

function mkTmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "autoagent-test-"));
  execSync("git init", { cwd: dir, stdio: "ignore" });
  execSync("git config user.email 'test@test.com'", { cwd: dir, stdio: "ignore" });
  execSync("git config user.name 'Test'", { cwd: dir, stdio: "ignore" });
  return dir;
}

function addFile(dir: string, name = "file.txt", content = "hello"): void {
  fs.writeFileSync(path.join(dir, name), content);
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── autoCommit tests ──────────────────────────────────────────

describe("autoCommit", () => {
  let tmpDir: string;

  beforeEach(() => {
    delete process.env.AUTOAGENT_NO_AUTOCOMMIT;
  });

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    delete process.env.AUTOAGENT_NO_AUTOCOMMIT;
  });

  it("commits when changes exist in a git repo", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir);

    const result = await autoCommit(tmpDir, "fix the login bug");

    expect(result.committed).toBe(true);
    expect(result.hash).toBeTruthy();
    expect(result.message).toBe("autoagent: fix the login bug");
  });

  it("returns committed:false when no changes", async () => {
    tmpDir = mkTmpRepo();
    // Create and commit a file first so it's clean
    addFile(tmpDir);
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir, stdio: "ignore" });

    const result = await autoCommit(tmpDir, "nothing to do");

    expect(result.committed).toBe(false);
    expect(result.hash).toBeUndefined();
  });

  it("returns committed:false when not in a git repo", async () => {
    const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), "autoagent-nonrepo-"));
    addFile(nonRepo);

    try {
      const result = await autoCommit(nonRepo, "some task");
      expect(result.committed).toBe(false);
    } finally {
      cleanup(nonRepo);
    }
  });

  it("returns committed:false when AUTOAGENT_NO_AUTOCOMMIT=1", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir);
    process.env.AUTOAGENT_NO_AUTOCOMMIT = "1";

    const result = await autoCommit(tmpDir, "should not commit");

    expect(result.committed).toBe(false);
  });

  it("truncates long summary to 72 chars in commit message", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir);
    const longSummary = "a".repeat(100);

    const result = await autoCommit(tmpDir, longSummary);

    expect(result.committed).toBe(true);
    expect(result.message).toBe(`autoagent: ${"a".repeat(72)}`);
  });

  it("commit message format is correct", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir);

    const result = await autoCommit(tmpDir, "add unit tests");

    expect(result.message).toMatch(/^autoagent: add unit tests$/);
  });

  it("handles multiline summary by using only first line", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir);

    const result = await autoCommit(tmpDir, "first line\nsecond line");

    expect(result.committed).toBe(true);
    expect(result.message).toBe("autoagent: first line");
  });
});

// ─── undoLastCommit tests ──────────────────────────────────────

describe("undoLastCommit", () => {
  let tmpDir: string;

  beforeEach(() => {
    delete process.env.AUTOAGENT_NO_AUTOCOMMIT;
  });

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    delete process.env.AUTOAGENT_NO_AUTOCOMMIT;
  });

  it("undoes an autoagent commit", async () => {
    tmpDir = mkTmpRepo();
    // Make initial commit so HEAD~1 exists
    addFile(tmpDir, "init.txt", "init");
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir, stdio: "ignore" });

    // Make autoagent commit
    addFile(tmpDir, "file.txt", "changed");
    execSync("git add -A && git commit -m 'autoagent: fix bug'", { cwd: tmpDir, stdio: "ignore" });
    const headBefore = execSync("git rev-parse HEAD", { cwd: tmpDir, encoding: "utf-8" }).trim();

    const result = await undoLastCommit(tmpDir);

    expect(result.undone).toBe(true);
    expect(result.message).toBe("autoagent: fix bug");
    expect(result.hash).toBeTruthy();

    // HEAD should have changed
    const headAfter = execSync("git rev-parse HEAD", { cwd: tmpDir, encoding: "utf-8" }).trim();
    expect(headAfter).not.toBe(headBefore);

    // Changes should be staged (soft reset)
    const staged = execSync("git diff --cached --name-only", { cwd: tmpDir, encoding: "utf-8" }).trim();
    expect(staged).toContain("file.txt");
  });

  it("refuses to undo a non-autoagent commit", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir, "init.txt", "init");
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir, stdio: "ignore" });
    addFile(tmpDir, "file.txt", "changed");
    execSync("git add -A && git commit -m 'manual commit'", { cwd: tmpDir, stdio: "ignore" });

    const result = await undoLastCommit(tmpDir);

    expect(result.undone).toBe(false);
    expect(result.error).toMatch(/not an autoagent commit/i);
  });

  it("refuses when working tree has uncommitted changes", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir, "init.txt", "init");
    execSync("git add -A && git commit -m 'autoagent: something'", { cwd: tmpDir, stdio: "ignore" });

    // Add an uncommitted change
    addFile(tmpDir, "dirty.txt", "dirty");

    const result = await undoLastCommit(tmpDir);

    expect(result.undone).toBe(false);
    expect(result.error).toMatch(/uncommitted changes/i);
  });

  it("returns undone:false outside a git repo", async () => {
    const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), "autoagent-nonrepo-"));
    try {
      const result = await undoLastCommit(nonRepo);
      expect(result.undone).toBe(false);
      expect(result.error).toMatch(/git repository/i);
    } finally {
      cleanup(nonRepo);
    }
  });

  it("returns undone:false when AUTOAGENT_NO_AUTOCOMMIT=1", async () => {
    tmpDir = mkTmpRepo();
    addFile(tmpDir, "init.txt", "init");
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir, stdio: "ignore" });
    addFile(tmpDir, "file.txt", "changed");
    execSync("git add -A && git commit -m 'autoagent: fix'", { cwd: tmpDir, stdio: "ignore" });
    process.env.AUTOAGENT_NO_AUTOCOMMIT = "1";

    const result = await undoLastCommit(tmpDir);

    expect(result.undone).toBe(false);
    expect(result.error).toMatch(/disabled/i);
  });
});
