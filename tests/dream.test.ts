import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FsLike } from "../src/dream.js";

// ─── Mock Anthropic ──────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

// ─── Helpers ────────────────────────────────────────────────

function makeFsLike(files: Record<string, string>): FsLike {
  return {
    existsSync: (p: string) => p in files,
    readFileSync: (p: string, _enc: "utf8") => files[p] ?? "",
    writeFileSync: vi.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("consolidateMemory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns updated memory from model response", async () => {
    const { consolidateMemory } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const updatedMem = "## Key Patterns\n- New pattern extracted from session";
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: updatedMem }] });

    const client = new Anthropic() as any;
    const result = await consolidateMemory(
      "Session: learned that X causes Y",
      "## Key Patterns\n- Old pattern",
      client,
    );

    expect(result).toBe(updatedMem);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("passes existing memory and session log to model", async () => {
    const { consolidateMemory } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "## Key Patterns\n- result" }] });

    const client = new Anthropic() as any;
    await consolidateMemory("my session log", "my existing memory", client);

    const call = mockCreate.mock.calls[0][0];
    const userContent = call.messages[0].content as string;
    expect(userContent).toContain("my existing memory");
    expect(userContent).toContain("my session log");
  });

  it("throws if model returns no text block", async () => {
    const { consolidateMemory } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    mockCreate.mockResolvedValue({ content: [] });

    const client = new Anthropic() as any;
    await expect(consolidateMemory("log", "memory", client)).rejects.toThrow("dream: no text response");
  });
});

describe("runDream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads files, consolidates, and writes result", async () => {
    const { runDream } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const existingMem = "## Key Patterns\n- entry one\n- entry two";
    const updatedMem  = "## Key Patterns\n- entry one\n- entry two\n- entry three";

    mockCreate.mockResolvedValue({ content: [{ type: "text", text: updatedMem }] });

    const fakeFs = makeFsLike({
      "/work/.autoagent.md": existingMem,
      "/work/agentlog.md": "session content",
    });

    const client = new Anthropic() as any;
    const result = await runDream("/work", client, fakeFs);

    expect(fakeFs.writeFileSync).toHaveBeenCalledWith("/work/.autoagent.md", updatedMem, "utf8");
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
  });

  it("returns zeros when no files exist", async () => {
    const { runDream } = await import("../src/dream.js");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;

    const fakeFs = makeFsLike({});
    const client = new Anthropic() as any;
    const result = await runDream("/empty", client, fakeFs);

    expect(result).toEqual({ added: 0, removed: 0 });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
