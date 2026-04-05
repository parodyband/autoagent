import { describe, it, expect, vi } from "vitest";
import {
  selectCompactionTier,
  MICRO_COMPACT_THRESHOLD,
  COMPACT_TIER1_THRESHOLD,
  COMPACT_THRESHOLD,
} from "../orchestrator.js";
import { Orchestrator } from "../orchestrator.js";

// ─── selectCompactionTier boundary tests ────────────────────────────────────

describe("selectCompactionTier", () => {
  it("returns 'none' below micro threshold", () => {
    expect(selectCompactionTier(0)).toBe("none");
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD - 1)).toBe("none");
  });

  it("returns 'micro' at MICRO_COMPACT_THRESHOLD", () => {
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD)).toBe("micro");
  });

  it("returns 'micro' between micro and tier1 thresholds", () => {
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD + 1)).toBe("micro");
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD - 1)).toBe("micro");
  });

  it("returns 'tier1' at COMPACT_TIER1_THRESHOLD", () => {
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD)).toBe("tier1");
  });

  it("returns 'tier1' between tier1 and compact thresholds", () => {
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD + 1)).toBe("tier1");
    expect(selectCompactionTier(COMPACT_THRESHOLD - 1)).toBe("tier1");
  });

  it("returns 'tier2' at COMPACT_THRESHOLD", () => {
    expect(selectCompactionTier(COMPACT_THRESHOLD)).toBe("tier2");
  });

  it("returns 'tier2' above COMPACT_THRESHOLD", () => {
    expect(selectCompactionTier(COMPACT_THRESHOLD + 10_000)).toBe("tier2");
  });

  it("covers exact boundary values from spec", () => {
    expect(selectCompactionTier(79_999)).toBe("none");
    expect(selectCompactionTier(80_000)).toBe("micro");
    expect(selectCompactionTier(99_999)).toBe("micro");
    expect(selectCompactionTier(100_000)).toBe("tier1");
    expect(selectCompactionTier(149_999)).toBe("tier1");
    expect(selectCompactionTier(150_000)).toBe("tier2");
  });
});

// ─── microCompact clears stale tool_result contents ─────────────────────────

describe("microCompact", () => {
  function makeOrchestrator() {
    return new Orchestrator({ workDir: "/tmp" });
  }

  function buildMessages(assistantTurns: number) {
    const msgs: import("@anthropic-ai/sdk").MessageParam[] = [];
    // Initial user message
    msgs.push({ role: "user", content: "hello" });
    for (let i = 0; i < assistantTurns; i++) {
      msgs.push({
        role: "assistant",
        content: [{ type: "tool_use", id: `tu_${i}`, name: "bash", input: { command: "ls" } }],
      });
      msgs.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: `tu_${i}`, content: `output_${i}` }],
      });
    }
    return msgs;
  }

  it("clears old tool_result contents beyond the keep window", () => {
    const orch = makeOrchestrator();
    // Inject 8 assistant turns (16 messages + 1 initial = 17 total)
    const msgs = buildMessages(8);
    // @ts-ignore — inject directly for testing
    orch.apiMessages = msgs;

    orch.microCompact(msgs.length);

    // @ts-ignore
    const apiMsgs: import("@anthropic-ai/sdk").MessageParam[] = orch.apiMessages;
    // Find user messages with tool_result content
    const toolResultMsgs = apiMsgs.filter(
      m => m.role === "user" && Array.isArray(m.content) &&
        (m.content as unknown[]).some((b: unknown) =>
          typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "tool_result"
        )
    );
    expect(toolResultMsgs.length).toBeGreaterThan(0);

    // Old tool results (not in recent window) should have cleared content
    const clearedResults = toolResultMsgs.filter(m =>
      (m.content as Array<{ type: string; content?: string | Array<{type:string;text?:string}> }>).some(
        b => b.type === "tool_result" && typeof b.content === "string" && b.content.startsWith("[Tool output cleared")
      )
    );
    expect(clearedResults.length).toBeGreaterThan(0);
  });

  it("does not clear tool_results in the most recent window", () => {
    const orch = makeOrchestrator();
    const msgs = buildMessages(8);
    // @ts-ignore
    orch.apiMessages = msgs;

    orch.microCompact(msgs.length);

    // @ts-ignore
    const apiMsgs: import("@anthropic-ai/sdk").MessageParam[] = orch.apiMessages;
    // The last tool_result message should still have its original content
    const lastUserWithTool = [...apiMsgs].reverse().find(
      m => m.role === "user" && Array.isArray(m.content) &&
        (m.content as unknown[]).some((b: unknown) =>
          typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "tool_result"
        )
    );
    expect(lastUserWithTool).toBeDefined();
    const lastResult = (lastUserWithTool!.content as Array<{ type: string; content?: string }>)
      .find(b => b.type === "tool_result");
    expect(lastResult?.content).not.toBe("[compacted]");
  });
});
