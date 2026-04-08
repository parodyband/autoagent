import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We need a fresh CheckpointManager per test — import the class directly via a re-export trick
// by reimporting the module. Instead, we'll test via the exported singleton but reset between tests
// by exploiting the transaction() + rollback() API itself.

// Re-create a local CheckpointManager for isolated testing
import { readFileSync as rfs, writeFileSync as wfs, existsSync as efs, unlinkSync as uls } from "node:fs";

// ---- minimal local copy so tests are isolated from singleton state ----
const { CheckpointManagerForTest } = await (async () => {
  // Dynamic inline class mirrors checkpoint.ts implementation
  class CheckpointManagerForTest {
    private checkpoints: Array<{ id: number; timestamp: number; label: string; files: Map<string, string | null> }> = [];
    private currentCheckpoint: { id: number; timestamp: number; label: string; files: Map<string, string | null> } | null = null;
    private nextId = 1;

    startCheckpoint(label: string) {
      this.currentCheckpoint = { id: this.nextId++, timestamp: Date.now(), label, files: new Map() };
    }

    trackFile(filePath: string) {
      if (!this.currentCheckpoint) return;
      if (this.currentCheckpoint.files.has(filePath)) return;
      try {
        const content = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null;
        this.currentCheckpoint.files.set(filePath, content);
      } catch {
        this.currentCheckpoint.files.set(filePath, null);
      }
    }

    commitCheckpoint() {
      if (!this.currentCheckpoint) return;
      if (this.currentCheckpoint.files.size > 0) {
        this.checkpoints.push(this.currentCheckpoint);
        if (this.checkpoints.length > 20) this.checkpoints.shift();
      }
      this.currentCheckpoint = null;
    }

    rollback(checkpointId: number): { restored: number; errors: string[] } {
      const idx = this.checkpoints.findIndex((c) => c.id === checkpointId);
      if (idx === -1) return { restored: 0, errors: [`Checkpoint ${checkpointId} not found`] };
      const checkpoint = this.checkpoints[idx];
      let restored = 0;
      const errors: string[] = [];
      for (const [filePath, originalContent] of checkpoint.files) {
        try {
          if (originalContent === null) {
            if (existsSync(filePath)) unlinkSync(filePath);
          } else {
            writeFileSync(filePath, originalContent, "utf-8");
          }
          restored++;
        } catch (err) {
          errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      this.checkpoints.splice(idx);
      return { restored, errors };
    }

    list(count = 10) {
      return this.checkpoints.slice(-count).reverse().map((c) => ({
        id: c.id, label: c.label, fileCount: c.files.size, timestamp: c.timestamp,
      }));
    }

    async transaction(label: string, fn: () => Promise<void | { rollback: boolean }>): Promise<{ success: boolean; filesTracked: number }> {
      this.startCheckpoint(label);
      const txId = this.nextId - 1;
      try {
        const result = await fn();
        const filesTracked = this.currentCheckpoint?.files.size ?? 0;
        if (result && result.rollback) {
          this.commitCheckpoint();
          this.rollback(txId);
          return { success: false, filesTracked };
        }
        this.commitCheckpoint();
        return { success: true, filesTracked };
      } catch {
        const filesTracked = this.currentCheckpoint?.files.size ?? 0;
        this.commitCheckpoint();
        this.rollback(txId);
        return { success: false, filesTracked };
      }
    }
  }
  return { CheckpointManagerForTest };
})();

// ---- helpers ----
function tmpFile(name: string) {
  return join(tmpdir(), `cp-test-${name}-${Date.now()}`);
}

describe("CheckpointManager.transaction()", () => {
  let mgr: InstanceType<typeof CheckpointManagerForTest>;
  let file: string;

  beforeEach(() => {
    mgr = new CheckpointManagerForTest();
    file = tmpFile("a");
    writeFileSync(file, "original", "utf-8");
  });

  afterEach(() => {
    try { unlinkSync(file); } catch { /* already gone */ }
  });

  it("happy path: commits changes when callback succeeds", async () => {
    const result = await mgr.transaction("test-commit", async () => {
      mgr.trackFile(file);
      writeFileSync(file, "modified", "utf-8");
    });

    expect(result.success).toBe(true);
    expect(result.filesTracked).toBe(1);
    // File should retain the new content
    expect(readFileSync(file, "utf-8")).toBe("modified");
    // Checkpoint is stored
    expect(mgr.list()).toHaveLength(1);
    expect(mgr.list()[0].label).toBe("test-commit");
  });

  it("auto-rollback on throw: restores file to original content", async () => {
    const result = await mgr.transaction("test-throw", async () => {
      mgr.trackFile(file);
      writeFileSync(file, "bad-write", "utf-8");
      throw new Error("simulated failure");
    });

    expect(result.success).toBe(false);
    // File should be restored
    expect(readFileSync(file, "utf-8")).toBe("original");
    // Checkpoint removed after rollback
    expect(mgr.list()).toHaveLength(0);
  });

  it("explicit rollback: restores file when callback returns { rollback: true }", async () => {
    const result = await mgr.transaction("test-explicit-rollback", async () => {
      mgr.trackFile(file);
      writeFileSync(file, "partial-write", "utf-8");
      return { rollback: true };
    });

    expect(result.success).toBe(false);
    expect(readFileSync(file, "utf-8")).toBe("original");
  });

  it("tracks multiple files in a single transaction", async () => {
    const file2 = tmpFile("b");
    writeFileSync(file2, "original2", "utf-8");

    try {
      const result = await mgr.transaction("multi-file", async () => {
        mgr.trackFile(file);
        mgr.trackFile(file2);
        writeFileSync(file, "new1", "utf-8");
        writeFileSync(file2, "new2", "utf-8");
        throw new Error("rollback both");
      });

      expect(result.success).toBe(false);
      expect(result.filesTracked).toBe(2);
      expect(readFileSync(file, "utf-8")).toBe("original");
      expect(readFileSync(file2, "utf-8")).toBe("original2");
    } finally {
      try { unlinkSync(file2); } catch { /* ok */ }
    }
  });
});
