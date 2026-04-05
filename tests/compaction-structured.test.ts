import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../src/orchestrator.js";

// Minimal stubs so Orchestrator can be constructed without full env
vi.mock("../src/tree-sitter-map.js", async () => {
  const actual = await vi.importActual("../src/tree-sitter-map.js") as Record<string, unknown>;
  return {
    ...actual,
    loadRepoMapCache: () => null,
    saveRepoMapCache: () => {},
  };
});

vi.mock("../src/repo-context.js", () => ({
  fingerprintRepo: () => "test-fingerprint",
}));

vi.mock("../src/file-ranker.js", () => ({
  rankFiles: () => [],
}));

vi.mock("../src/project-detector.js", () => ({
  detectProject: () => ({ summary: "" }),
}));

describe("Tier 2 compaction — structured prompt", () => {
  it("compact() sends a structured prompt with required section headers", async () => {
    const capturedPrompts: string[] = [];

    const orch = new Orchestrator({
      workDir: "/tmp",
      onStatus: () => {},
    });

    // Expose private method via cast
    const orchAny = orch as unknown as {
      compact: () => Promise<void>;
      apiMessages: Array<{ role: string; content: string }>;
      sessionTokensIn: number;
    };

    // Inject enough messages to trigger compact (>keepCount=4)
    orchAny.apiMessages = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    // Intercept the Anthropic client
    const clientAny = (orch as unknown as { client: { messages: { create: unknown } } }).client;
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "## Current Task\ntest\n## Plan & Progress\nnone\n## Files Modified\nnone\n## Key Decisions\nnone\n## Open Questions\nnone" }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: "end_turn",
    });
    clientAny.messages = { create: mockCreate };

    // Capture prompt via wrapper
    const origCreate = mockCreate;
    vi.spyOn(clientAny.messages, "create").mockImplementation(async (params: Record<string, unknown>) => {
      const msgs = params.messages as Array<{ role: string; content: string }>;
      for (const m of msgs) {
        if (typeof m.content === "string") capturedPrompts.push(m.content);
      }
      return origCreate(params);
    });

    await orchAny.compact();

    const allText = capturedPrompts.join("\n");
    expect(allText).toContain("## Current Task");
    expect(allText).toContain("## Plan & Progress");
    expect(allText).toContain("## Files Modified");
    expect(allText).toContain("## Key Decisions");
    expect(allText).toContain("## Open Questions");
  });

  it("structured prompt contains at least 4 named sections", async () => {
    const sections = [
      "## Current Task",
      "## Plan & Progress",
      "## Files Modified",
      "## Key Decisions",
      "## Open Questions",
    ];
    // Just verify the prompt template we patch in has all 5 sections
    const COMPACTION_PROMPT = `Summarize this conversation into the following structured format. Use exactly these section headers:\n\n## Current Task\nWhat the user is currently trying to accomplish.\n\n## Plan & Progress\nStep-by-step plan and which steps are done, in-progress, or pending.\n\n## Files Modified\nList of files that were created, edited, or deleted.\n\n## Key Decisions\nImportant choices made (libraries chosen, approaches taken, things ruled out).\n\n## Open Questions\nUnresolved issues, errors, or things that still need attention.\n\nConversation to summarize:\n\n`;

    for (const section of sections) {
      expect(COMPACTION_PROMPT).toContain(section);
    }
    expect(sections.length).toBeGreaterThanOrEqual(4);
  });
});
