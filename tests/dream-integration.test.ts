import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { FsLike } from "../src/dream.js";

// ─── Mock Anthropic (module-level) ──────────────────────────

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

// ─── Helpers ────────────────────────────────────────────────

function makeFsLike(files: Record<string, string>): FsLike & { written: Record<string, string> } {
  const written: Record<string, string> = {};
  return {
    existsSync: (p: string) => p in files,
    readFileSync: (p: string, _enc: "utf8") => files[p] ?? "",
    writeFileSync: (p: string, data: string, _enc: "utf8") => { written[p] = data; },
    written,
  };
}

// ─── Integration tests ──────────────────────────────────────

describe("runDream integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads .autoagent.md and agentlog.md, calls model, writes result", async () => {
    const { runDream } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const existing = "## Key Patterns\n- old pattern";
    const updated  = "## Key Patterns\n- old pattern\n- new insight";
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: updated }] });

    const fakeFs = makeFsLike({
      "/proj/.autoagent.md": existing,
      "/proj/agentlog.md": "## Session\nLearned X causes Y",
    });

    const result = await runDream("/proj", new Anthropic() as any, fakeFs);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(fakeFs.written["/proj/.autoagent.md"]).toBe(updated);
    expect(result.added).toBeGreaterThanOrEqual(0);
    expect(result.removed).toBeGreaterThanOrEqual(0);
  });

  it("no-op when neither memory nor log file exists", async () => {
    const { runDream } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const fakeFs = makeFsLike({});
    const result = await runDream("/empty", new Anthropic() as any, fakeFs);

    expect(result).toEqual({ added: 0, removed: 0 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("works when only .autoagent.md exists (no agentlog)", async () => {
    const { runDream } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const existing = "## Key Patterns\n- pattern A\n- pattern B";
    const updated  = "## Key Patterns\n- pattern A\n- pattern B\n- pattern C";
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: updated }] });

    const fakeFs = makeFsLike({ "/proj/.autoagent.md": existing });

    const result = await runDream("/proj", new Anthropic() as any, fakeFs);

    expect(fakeFs.written["/proj/.autoagent.md"]).toBe(updated);
    expect(result).toBeDefined();
  });
});
