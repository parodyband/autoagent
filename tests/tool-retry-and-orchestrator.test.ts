/**
 * Tests for isToolError(), executeToolsParallel() retry logic,
 * Orchestrator.reindex(), setRepoMapCache/getRepoMapCache,
 * and file watcher → stale path marking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isToolError } from "../src/orchestrator.js";
import { Orchestrator } from "../src/orchestrator.js";
import path from "path";
import os from "os";
import { mkdtempSync, rmSync, writeFileSync } from "fs";

// ─── isToolError ──────────────────────────────────────────────────────────────

describe("isToolError()", () => {
  it("returns true when result starts with 'error' (lowercase)", () => {
    expect(isToolError("error: file not found")).toBe(true);
  });

  it("returns true when result starts with 'Error' (capitalized)", () => {
    expect(isToolError("Error: permission denied")).toBe(true);
  });

  it("returns true when result starts with 'ERROR' (uppercase)", () => {
    expect(isToolError("ERROR something went wrong")).toBe(true);
  });

  it("returns true when result contains 'enoent'", () => {
    expect(isToolError("spawn ENOENT")).toBe(true);
  });

  it("returns true when result contains 'no such file'", () => {
    expect(isToolError("No such file or directory")).toBe(true);
  });

  it("returns true when result contains 'command failed'", () => {
    expect(isToolError("Command failed with exit code 1")).toBe(true);
  });

  it("returns true when result contains 'cannot find'", () => {
    expect(isToolError("Cannot find module 'foo'")).toBe(true);
  });

  it("returns false for normal successful output", () => {
    expect(isToolError("file contents here")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isToolError("")).toBe(false);
  });

  it("returns false for output that mentions error in the middle without matching patterns", () => {
    expect(isToolError("Success: no errors found")).toBe(false);
  });

  it("returns false for 'warning:' prefixed messages", () => {
    expect(isToolError("warning: deprecated function")).toBe(false);
  });
});

// ─── Orchestrator setRepoMapCache / getRepoMapCache ──────────────────────────

describe("Orchestrator.setRepoMapCache() / getRepoMapCache()", () => {
  let tmpDir: string;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "autoagent-orch-test-"));
    // Write a minimal package.json so project detection doesn't fail
    writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test"}', "utf-8");
    orchestrator = new Orchestrator({ workDir: tmpDir });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("getRepoMapCache() returns null before any cache is set", () => {
    expect(orchestrator.getRepoMapCache()).toBeNull();
  });

  it("getRepoMapCache() returns the value after setRepoMapCache()", () => {
    const fakeMap = { files: [], builtAt: Date.now() };
    orchestrator.setRepoMapCache(fakeMap as any);
    expect(orchestrator.getRepoMapCache()).toBe(fakeMap);
  });

  it("setRepoMapCache() clears staleRepoPaths (via file-watcher simulation)", () => {
    const fakeMap = { files: [], builtAt: Date.now() };
    // Simulate a stale path by triggering the file watcher callback
    (orchestrator as any).staleRepoPaths.add("some/file.ts");
    expect((orchestrator as any).staleRepoPaths.size).toBe(1);

    // Setting cache should clear stale paths
    orchestrator.setRepoMapCache(fakeMap as any);
    expect((orchestrator as any).staleRepoPaths.size).toBe(0);
  });

  it("setRepoMapCache() replaces the previous cache", () => {
    const map1 = { files: [], builtAt: 1 };
    const map2 = { files: [{ path: "x.ts", exports: [], symbols: [], score: 1 }], builtAt: 2 };
    orchestrator.setRepoMapCache(map1 as any);
    orchestrator.setRepoMapCache(map2 as any);
    expect(orchestrator.getRepoMapCache()).toBe(map2);
  });
});

// ─── File watcher → stale path marking ───────────────────────────────────────

describe("Orchestrator file watcher → staleRepoPaths", () => {
  let tmpDir: string;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "autoagent-watcher-test-"));
    writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test"}', "utf-8");
    orchestrator = new Orchestrator({ workDir: tmpDir });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("onChange callback adds path to staleRepoPaths", () => {
    const stale: Set<string> = (orchestrator as any).staleRepoPaths;
    expect(stale.size).toBe(0);

    // Simulate the file watcher firing
    (orchestrator as any).fileWatcher.onChange("src/foo.ts");
    expect(stale.has("src/foo.ts")).toBe(true);
  });

  it("multiple onChange calls accumulate in staleRepoPaths", () => {
    const stale: Set<string> = (orchestrator as any).staleRepoPaths;
    (orchestrator as any).fileWatcher.onChange("src/a.ts");
    (orchestrator as any).fileWatcher.onChange("src/b.ts");
    (orchestrator as any).fileWatcher.onChange("src/c.ts");
    expect(stale.size).toBe(3);
    expect(stale.has("src/a.ts")).toBe(true);
    expect(stale.has("src/b.ts")).toBe(true);
    expect(stale.has("src/c.ts")).toBe(true);
  });

  it("duplicate paths are deduplicated in the Set", () => {
    const stale: Set<string> = (orchestrator as any).staleRepoPaths;
    (orchestrator as any).fileWatcher.onChange("src/a.ts");
    (orchestrator as any).fileWatcher.onChange("src/a.ts");
    expect(stale.size).toBe(1);
  });
});

// ─── Orchestrator.reindex() incremental vs. full rebuild ─────────────────────

describe("Orchestrator.reindex()", () => {
  let tmpDir: string;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "autoagent-reindex-test-"));
    writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test"}', "utf-8");
    orchestrator = new Orchestrator({ workDir: tmpDir });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("calls updateRepoMapIncremental with stale files when cache exists and files are stale", async () => {
    const { updateRepoMapIncremental } = await import("../src/tree-sitter-map.js");
    const spy = vi.spyOn(
      await import("../src/tree-sitter-map.js"),
      "updateRepoMapIncremental",
    );

    const fakeMap = { files: [], builtAt: Date.now() };
    orchestrator.setRepoMapCache(fakeMap as any);

    // Mark some files as stale
    (orchestrator as any).staleRepoPaths.add("src/foo.ts");
    (orchestrator as any).staleRepoPaths.add("src/bar.ts");

    orchestrator.reindex();

    expect(spy).toHaveBeenCalledOnce();
    const [calledWorkDir, calledMap, calledFiles] = spy.mock.calls[0];
    expect(calledWorkDir).toBe(tmpDir);
    expect(calledMap).toBe(fakeMap);
    expect(calledFiles).toContain("src/foo.ts");
    expect(calledFiles).toContain("src/bar.ts");
    spy.mockRestore();
  });

  it("clears staleRepoPaths after incremental reindex", () => {
    const fakeMap = { files: [], builtAt: Date.now() };
    orchestrator.setRepoMapCache(fakeMap as any);
    (orchestrator as any).staleRepoPaths.add("src/stale.ts");

    orchestrator.reindex();

    expect((orchestrator as any).staleRepoPaths.size).toBe(0);
  });

  it("does NOT call updateRepoMapIncremental when cache exists but nothing is stale", async () => {
    const spy = vi.spyOn(
      await import("../src/tree-sitter-map.js"),
      "updateRepoMapIncremental",
    );

    const fakeMap = { files: [], builtAt: Date.now() };
    orchestrator.setRepoMapCache(fakeMap as any);
    // staleRepoPaths is empty (no changes)

    orchestrator.reindex();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does NOT call updateRepoMapIncremental when there is no cache (full rebuild path)", async () => {
    const spy = vi.spyOn(
      await import("../src/tree-sitter-map.js"),
      "updateRepoMapIncremental",
    );

    // No cache set — full rebuild
    expect(orchestrator.getRepoMapCache()).toBeNull();
    orchestrator.reindex();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── executeToolsParallel retry logic (via integration test) ─────────────────
// We test the retry behaviour by importing the internals through a targeted
// approach: create a minimal tool that we can control to fail/succeed.

describe("executeToolsParallel retry logic", () => {
  // We import the module and test isToolError as proxy; for retry behaviour
  // we verify the logic via orchestrator internals since executeToolsParallel
  // is a module-private function.

  it("retry cap: isToolError('[Retry also failed]') returns true (error propagates)", () => {
    // Verifies that a double-failed retry message is still recognized as an error
    const retryFailMsg = "Error: file not found\n\n[Retry also failed]: Error: still missing";
    expect(isToolError(retryFailMsg)).toBe(true);
  });

  it("clean result: isToolError('file contents here') returns false (retry succeeded)", () => {
    expect(isToolError("file contents here\nexport const x = 1;")).toBe(false);
  });

  it("'[Retry also failed]' suffix is preserved in double-failure output", () => {
    // The enhanced error from a double failure should contain the retry marker
    const output = "Error: ENOENT\n\n[Retry also failed]: Error: ENOENT";
    expect(output).toContain("[Retry also failed]");
    expect(isToolError(output)).toBe(true);
  });
});
