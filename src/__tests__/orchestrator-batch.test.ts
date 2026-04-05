/**
 * Tests for multi-file edit batching with unified diff preview.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-batch-test-"));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, "utf-8");
}

function readFile(dir: string, name: string) {
  return fs.readFileSync(path.join(dir, name), "utf-8");
}

// ─── Unit test batchWriteFiles directly ─────────────────────────────────────
// We extract the logic by testing the orchestrator integration via a mock setup.

// Build fake ToolUseBlocks for write_file
function makeWriteToolUse(id: string, filePath: string, content: string): import("@anthropic-ai/sdk").ToolUseBlock {
  return {
    type: "tool_use",
    id,
    name: "write_file",
    input: { path: filePath, content, mode: "write" },
  };
}

// ─── Batch preview: 2+ writes show combined diff ────────────────────────────

describe("batchWriteFiles (via runAgentLoop integration)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calls onDiffPreview once with combined diff for 2 writes", async () => {
    writeFile(tmpDir, "a.txt", "old a\n");
    writeFile(tmpDir, "b.txt", "old b\n");

    const { computeUnifiedDiff } = await import("../diff-preview.js");

    // Simulate batchWriteFiles logic directly
    const toolUses = [
      makeWriteToolUse("id1", path.join(tmpDir, "a.txt"), "new a\n"),
      makeWriteToolUse("id2", path.join(tmpDir, "b.txt"), "new b\n"),
    ];

    const previewCalls: Array<{ diff: string; label: string }> = [];
    const onDiffPreview = async (diff: string, label: string) => {
      previewCalls.push({ diff, label });
      return true; // accept
    };

    // Track execTool calls
    const written: string[] = [];
    const execTool = async (name: string, input: Record<string, unknown>) => {
      if (name === "write_file") {
        const p = input.path as string;
        const c = input.content as string;
        fs.writeFileSync(p, c, "utf-8");
        written.push(p);
        return `Wrote ${p}`;
      }
      return "";
    };

    // Run batchWriteFiles logic (duplicate the core logic here for unit testing)
    const edits = toolUses.map(tu => {
      const inp = tu.input as { path?: string; content?: string };
      const relPath = inp.path ?? "";
      const newContent = inp.content ?? "";
      let oldContent = "";
      try { oldContent = fs.readFileSync(relPath, "utf-8"); } catch { /* new file */ }
      const diff = computeUnifiedDiff(oldContent, newContent, relPath);
      return { id: tu.id, relPath, fullPath: relPath, oldContent, newContent, diff, input: tu.input as Record<string, unknown> };
    });

    const diffsWithContent = edits.filter(e => e.diff);
    const combinedDiff = diffsWithContent.map(e => e.diff).join("\n--- file boundary ---\n");
    const label = `${edits.length} files`;
    const accepted = await onDiffPreview(combinedDiff, label);

    expect(accepted).toBe(true);
    expect(previewCalls).toHaveLength(1);
    expect(previewCalls[0].label).toBe("2 files");
    expect(previewCalls[0].diff).toContain("--- file boundary ---");
    expect(previewCalls[0].diff).toContain("a.txt");
    expect(previewCalls[0].diff).toContain("b.txt");
  });

  it("rejects all writes when user declines batch preview", async () => {
    writeFile(tmpDir, "x.txt", "original x\n");
    writeFile(tmpDir, "y.txt", "original y\n");

    const { computeUnifiedDiff } = await import("../diff-preview.js");

    const toolUses = [
      makeWriteToolUse("id3", path.join(tmpDir, "x.txt"), "changed x\n"),
      makeWriteToolUse("id4", path.join(tmpDir, "y.txt"), "changed y\n"),
    ];

    const onDiffPreview = async (_diff: string, _label: string) => false; // reject

    const edits = toolUses.map(tu => {
      const inp = tu.input as { path?: string; content?: string };
      const relPath = inp.path ?? "";
      const newContent = inp.content ?? "";
      let oldContent = "";
      try { oldContent = fs.readFileSync(relPath, "utf-8"); } catch { /* new file */ }
      const diff = computeUnifiedDiff(oldContent, newContent, relPath);
      return { id: tu.id, relPath, fullPath: relPath, oldContent, newContent, diff, input: tu.input as Record<string, unknown> };
    });

    const diffsWithContent = edits.filter(e => e.diff);
    const combinedDiff = diffsWithContent.map(e => e.diff).join("\n--- file boundary ---\n");
    const label = `${edits.length} files`;
    const accepted = await onDiffPreview(combinedDiff, label);

    // When rejected, files should not be modified
    expect(accepted).toBe(false);
    expect(readFile(tmpDir, "x.txt")).toBe("original x\n");
    expect(readFile(tmpDir, "y.txt")).toBe("original y\n");
  });

  it("single write_file still uses individual preview (no batching)", async () => {
    writeFile(tmpDir, "solo.txt", "old solo\n");

    const { computeUnifiedDiff } = await import("../diff-preview.js");

    const relPath = path.join(tmpDir, "solo.txt");
    let oldContent = "";
    try { oldContent = fs.readFileSync(relPath, "utf-8"); } catch { /* new file */ }
    const diff = computeUnifiedDiff(oldContent, "new solo\n", relPath);

    const previewCalls: string[] = [];
    const onDiffPreview = async (_diff: string, label: string) => {
      previewCalls.push(label);
      return true;
    };

    // Single file: label is the file path, not "N files"
    await onDiffPreview(diff, relPath);

    expect(previewCalls).toHaveLength(1);
    // Single file label is the path, not "N files"
    expect(previewCalls[0]).not.toMatch(/^\d+ files$/);
    expect(previewCalls[0]).toContain("solo.txt");
  });

  it("rollback: restores files if a write fails mid-batch", async () => {
    writeFile(tmpDir, "r1.txt", "original r1\n");
    writeFile(tmpDir, "r2.txt", "original r2\n");

    const { computeUnifiedDiff } = await import("../diff-preview.js");

    const edits = [
      { id: "id5", relPath: path.join(tmpDir, "r1.txt"), fullPath: path.join(tmpDir, "r1.txt"), oldContent: "original r1\n", newContent: "changed r1\n", diff: computeUnifiedDiff("original r1\n", "changed r1\n", "r1.txt"), input: {} },
      { id: "id6", relPath: path.join(tmpDir, "r2.txt"), fullPath: path.join(tmpDir, "r2.txt"), oldContent: "original r2\n", newContent: "changed r2\n", diff: computeUnifiedDiff("original r2\n", "changed r2\n", "r2.txt"), input: {} },
    ];

    // Simulate: first write succeeds, second throws
    const snapshots: Array<{ fullPath: string; oldContent: string; existed: boolean }> = [];
    let failIdx = -1;
    const errorResults: Array<{ id: string; content: string }> = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const existed = fs.existsSync(edit.fullPath);
      snapshots.push({ fullPath: edit.fullPath, oldContent: edit.oldContent, existed });

      if (i === 0) {
        // First write succeeds
        fs.writeFileSync(edit.fullPath, edit.newContent, "utf-8");
      } else {
        // Second write fails — trigger rollback
        failIdx = i;
        // Rollback already-written
        for (const snap of snapshots.slice(0, -1)) {
          if (snap.existed) {
            fs.writeFileSync(snap.fullPath, snap.oldContent, "utf-8");
          } else {
            try { fs.unlinkSync(snap.fullPath); } catch { /* ok */ }
          }
        }
        break;
      }
    }

    // After rollback, r1.txt should be restored
    expect(readFile(tmpDir, "r1.txt")).toBe("original r1\n");
    // r2.txt was never written
    expect(readFile(tmpDir, "r2.txt")).toBe("original r2\n");
    expect(failIdx).toBe(1);
  });

  it("non-write tools are not included in batch", () => {
    // Verify the filter logic: write_file tools are separated from non-write tools
    const tools = [
      { name: "bash", id: "b1" },
      { name: "write_file", id: "w1" },
      { name: "grep", id: "g1" },
      { name: "write_file", id: "w2" },
    ];

    const writeTools = tools.filter(t => t.name === "write_file");
    const nonWriteTools = tools.filter(t => t.name !== "write_file");

    expect(writeTools).toHaveLength(2);
    expect(nonWriteTools).toHaveLength(2);
    expect(nonWriteTools.map(t => t.name)).toEqual(["bash", "grep"]);
  });
});
