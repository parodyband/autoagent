import { describe, it, expect, beforeEach } from "vitest";
import { Orchestrator, MICRO_COMPACT_THRESHOLD, COMPACT_TIER1_THRESHOLD } from "../orchestrator.js";
import Anthropic from "@anthropic-ai/sdk";

// Minimal orchestrator for testing microCompact directly
function makeOrchestrator() {
  const client = {} as Anthropic; // not used in unit tests
  return new Orchestrator(client, {
    workDir: "/tmp",
    onStatus: () => {},
  });
}

function makeToolResultMsg(turnLabel: string): { role: "user"; content: Array<{ type: string; tool_use_id: string; content: Array<{ type: string; text: string }> }> } {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: `id_${turnLabel}`,
        content: [{ type: "text", text: `output for ${turnLabel}` }],
      },
    ],
  };
}

function makeAssistantMsg(label: string) {
  return { role: "assistant" as const, content: `response ${label}` };
}

describe("microCompact", () => {
  it("clears tool_result contents older than 5 assistant turns", () => {
    const orch = makeOrchestrator();
    // Build 8 pairs: tool_result + assistant
    const msgs: Array<{ role: "user" | "assistant"; content: unknown }> = [];
    for (let i = 1; i <= 8; i++) {
      msgs.push(makeToolResultMsg(`t${i}`));
      msgs.push(makeAssistantMsg(`a${i}`));
    }
    (orch as unknown as { apiMessages: typeof msgs }).apiMessages = msgs;

    orch.microCompact(99);

    // 8 pairs → indices: 0(tr),1(a),2(tr),3(a),...,14(tr),15(a)
    // assistantIndices (most recent first): 15,13,11,9,7 → cutoffIdx = 7
    // Indices < 7 are cleared: tool_results at 0,2,4,6 → but index 6 is tool_result for t4
    // Preserved tool_results: 8,10,12,14
    const cleared = [0, 2, 4, 6];
    const preserved = [8, 10, 12, 14];

    for (const idx of cleared) {
      const block = (msgs[idx] as ReturnType<typeof makeToolResultMsg>).content[0];
      expect((block.content[0] as { text: string }).text).toMatch(/\[Tool output cleared/);
    }
    for (const idx of preserved) {
      const block = (msgs[idx] as ReturnType<typeof makeToolResultMsg>).content[0];
      expect((block.content[0] as { text: string }).text).toMatch(/^output for/);
    }
  });

  it("preserves all tool results when fewer than 5 assistant turns exist", () => {
    const orch = makeOrchestrator();
    const msgs = [
      makeToolResultMsg("t1"),
      makeAssistantMsg("a1"),
      makeToolResultMsg("t2"),
      makeAssistantMsg("a2"),
    ];
    (orch as unknown as { apiMessages: typeof msgs }).apiMessages = msgs;

    orch.microCompact(10);

    // cutoffIdx = assistantIndices[4] ?? 0 = 0, so nothing is cleared
    const b1 = (msgs[0] as ReturnType<typeof makeToolResultMsg>).content[0];
    const b2 = (msgs[2] as ReturnType<typeof makeToolResultMsg>).content[0];
    expect((b1.content[0] as { text: string }).text).toBe("output for t1");
    expect((b2.content[0] as { text: string }).text).toBe("output for t2");
  });

  it("handles empty message list without error", () => {
    const orch = makeOrchestrator();
    (orch as unknown as { apiMessages: unknown[] }).apiMessages = [];
    expect(() => orch.microCompact(0)).not.toThrow();
  });

  it("clears string-content tool_results (not just array content)", () => {
    const orch = makeOrchestrator();
    const msgs: Array<{ role: "user" | "assistant"; content: unknown }> = [];
    // 6 pairs so cutoffIdx > 0
    for (let i = 1; i <= 6; i++) {
      msgs.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: `id_t${i}`, content: `string output ${i}` }],
      });
      msgs.push(makeAssistantMsg(`a${i}`));
    }
    (orch as unknown as { apiMessages: typeof msgs }).apiMessages = msgs;

    orch.microCompact(42);

    // First pair (index 0) should be cleared
    const block = (msgs[0].content as Array<{ content: string }>)[0];
    expect(block.content).toMatch(/\[Tool output cleared/);
  });

  it("message structure is preserved (tool_use_id remains intact)", () => {
    const orch = makeOrchestrator();
    const msgs: Array<{ role: "user" | "assistant"; content: unknown }> = [];
    for (let i = 1; i <= 6; i++) {
      msgs.push(makeToolResultMsg(`t${i}`));
      msgs.push(makeAssistantMsg(`a${i}`));
    }
    (orch as unknown as { apiMessages: typeof msgs }).apiMessages = msgs;

    orch.microCompact(5);

    // tool_use_id should still be present on cleared blocks
    const cleared = (msgs[0] as ReturnType<typeof makeToolResultMsg>).content[0];
    expect(cleared.tool_use_id).toBe("id_t1");
    expect(cleared.type).toBe("tool_result");
  });

  it("MICRO_COMPACT_THRESHOLD is 80K and below COMPACT_TIER1_THRESHOLD", () => {
    expect(MICRO_COMPACT_THRESHOLD).toBe(80_000);
    expect(MICRO_COMPACT_THRESHOLD).toBeLessThan(COMPACT_TIER1_THRESHOLD);
  });
});
