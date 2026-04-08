import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// We need a fresh CheckpointManager instance per test — import the class directly
// by re-instantiating via the module internals. Since only the singleton is exported,
// we replicate a local instance approach by importing the module and resetting state
// through the public API.

// ── Helpers ───────────────────────────────────────────────────────────────────

const TMP = join(process.cwd(), ".test-checkpoint-tmp");

function setup() {
  mkdirSync(TMP, { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

function tmpFile(name: string) {
  return join(TMP, name);
}

function writeFile(name: string, content: string) {
  writeFileSync(tmpFile(name), content, "utf-8");
}

function readFile(name: string) {
  return readFileSync(tmpFile(name), "utf-8");
}

// ── Import manager AFTER setup so paths resolve correctly ─────────────────────

// We instantiate our own CheckpointManager via dynamic import of the class.
// checkpoint.ts only exports a singleton — we need to reach the class. Since it
// isn't exported, we test through a thin wrapper that re-exports it for testing.
// Instead, let's just test the singleton by running transactions in sequence.

import { checkpointManager } from "../checkpoint.js";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkpoint transaction()", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("successful transaction commits — files are retained", async () => {
    const file = tmpFile("success.txt");
    writeFile("success.txt", "original");

    const result = await checkpointManager.transaction("test-success", async () => {
      // simulate a file change inside the transaction
      checkpointManager.trackFile(file);
      writeFileSync(file, "modified", "utf-8");
    });

    expect(result.success).toBe(true);
    expect(result.filesTracked).toBe(1);
    // File should have the new content since transaction committed
    expect(readFileSync(file, "utf-8")).toBe("modified");
  });

  it("throwing callback triggers rollback — file contents restored", async () => {
    const file = tmpFile("throw.txt");
    writeFile("throw.txt", "original-content");

    const result = await checkpointManager.transaction("test-throw", async () => {
      checkpointManager.trackFile(file);
      writeFileSync(file, "corrupted", "utf-8");
      throw new Error("simulated failure");
    });

    expect(result.success).toBe(false);
    // File should be restored to original content
    expect(readFileSync(file, "utf-8")).toBe("original-content");
  });

  it("callback returning { rollback: true } triggers rollback", async () => {
    const file = tmpFile("explicit-rollback.txt");
    writeFile("explicit-rollback.txt", "before");

    const result = await checkpointManager.transaction("test-explicit-rollback", async () => {
      checkpointManager.trackFile(file);
      writeFileSync(file, "after", "utf-8");
      return { rollback: true };
    });

    expect(result.success).toBe(false);
    // File should be restored to original
    expect(readFileSync(file, "utf-8")).toBe("before");
  });

  it("filesTracked count is accurate for multiple files", async () => {
    const fileA = tmpFile("track-a.txt");
    const fileB = tmpFile("track-b.txt");
    const fileC = tmpFile("track-c.txt");
    writeFile("track-a.txt", "a");
    writeFile("track-b.txt", "b");
    writeFile("track-c.txt", "c");

    const result = await checkpointManager.transaction("test-tracking", async () => {
      checkpointManager.trackFile(fileA);
      checkpointManager.trackFile(fileB);
      checkpointManager.trackFile(fileC);
    });

    expect(result.success).toBe(true);
    expect(result.filesTracked).toBe(3);
  });
});
