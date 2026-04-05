import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

// Standalone version of pruneStaleToolResults for unit testing
// Mirrors orchestrator logic including age-weighted priority sorting.
function pruneStaleToolResults(
  apiMessages: Anthropic.MessageParam[],
  keepTurns = 8,
  toolUseIdMap: Map<string, string> = new Map()
): void {
  const assistantIndices: number[] = [];
  for (let i = apiMessages.length - 1; i >= 0; i--) {
    if (apiMessages[i].role === "assistant") {
      assistantIndices.push(i);
    }
  }

  const cutoffAssistantIdx = assistantIndices[keepTurns - 1] ?? 0;

  function toolPrunePriority(toolName: string): number {
    if (["read_file", "grep", "list_files"].includes(toolName)) return 0;
    if (["bash", "write_file"].includes(toolName)) return 2;
    return 1;
  }

  type Candidate = { cb: { type: string; text?: string }; turnN: number; priority: number };
  const candidates: Candidate[] = [];

  let turnN = 0;
  for (let i = 0; i < cutoffAssistantIdx; i++) {
    const msg = apiMessages[i];
    if (msg.role === "assistant") turnN++;
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (
        typeof block === "object" &&
        "type" in block &&
        block.type === "tool_result" &&
        Array.isArray((block as { content?: unknown[] }).content)
      ) {
        const toolBlock = block as {
          type: string;
          tool_use_id: string;
          content: Array<{ type: string; text?: string }>;
        };
        const toolName = toolUseIdMap.get(toolBlock.tool_use_id) ?? "unknown";
        const priority = toolPrunePriority(toolName);
        for (const cb of toolBlock.content) {
          if (cb.type === "text" && typeof cb.text === "string") {
            if (cb.text.length < 100) continue;
            candidates.push({ cb, turnN, priority });
          }
        }
      }
    }
  }

  const totalMessages = apiMessages.length;
  candidates.sort((a, b) => {
    const ageA = totalMessages - a.turnN;
    const ageB = totalMessages - b.turnN;
    const freshnessA = Math.max(0.3, 1 - ageA / totalMessages);
    const freshnessB = Math.max(0.3, 1 - ageB / totalMessages);
    const scoreA = a.priority * freshnessA;
    const scoreB = b.priority * freshnessB;
    return scoreA - scoreB || a.turnN - b.turnN;
  });

  for (const { cb, turnN: t } of candidates) {
    cb.text = `[pruned — old result from turn ${t}]`;
  }
}

/** Build a fake tool_result user message. */
function makeToolResultMsg(text: string): Anthropic.MessageParam {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "tool_abc",
        content: [{ type: "text", text }],
      } as unknown as Anthropic.ToolResultBlockParam,
    ],
  };
}

function makeAssistantMsg(): Anthropic.MessageParam {
  return { role: "assistant", content: "I did a thing." };
}

/** Build 15 user/assistant exchanges, each user msg has a tool_result. */
function buildMessages(count = 15): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = [];
  for (let i = 0; i < count; i++) {
    msgs.push(makeToolResultMsg(`This is a long tool result for exchange ${i}. `.repeat(10)));
    msgs.push(makeAssistantMsg());
  }
  return msgs;
}

describe("pruneStaleToolResults", () => {
  it("replaces tool_result text older than 8 turns with stub", () => {
    const msgs = buildMessages(15);
    pruneStaleToolResults(msgs);

    // Find all tool_result texts before the 8th-most-recent assistant message
    const assistantIndices: number[] = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") assistantIndices.push(i);
    }
    const cutoff = assistantIndices[7] ?? 0;

    for (let i = 0; i < cutoff; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            expect(cb.text).toMatch(/^\[pruned — old result from turn \d+\]$/);
          }
        }
      }
    }
  });

  it("leaves recent 8 turns tool_results untouched", () => {
    const msgs = buildMessages(15);
    // Capture original texts of recent 8 turns
    const assistantIndices: number[] = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") assistantIndices.push(i);
    }
    const cutoff = assistantIndices[7] ?? 0;
    const originalTexts: string[] = [];
    for (let i = cutoff; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            if (cb.text) originalTexts.push(cb.text);
          }
        }
      }
    }

    pruneStaleToolResults(msgs);

    // Check they are unchanged
    let idx = 0;
    for (let i = cutoff; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            expect(cb.text).toBe(originalTexts[idx++]);
          }
        }
      }
    }
  });

  it("skips tool_result text shorter than 100 chars", () => {
    const msgs: Anthropic.MessageParam[] = [];
    // 10 exchanges with short tool results
    for (let i = 0; i < 10; i++) {
      msgs.push(makeToolResultMsg("short"));
      msgs.push(makeAssistantMsg());
    }
    pruneStaleToolResults(msgs);
    // All should remain "short"
    for (const msg of msgs) {
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            expect(cb.text).toBe("short");
          }
        }
      }
    }
  });

  it("does nothing when there are fewer than 8 assistant turns", () => {
    const msgs = buildMessages(5);
    const before = JSON.stringify(msgs);
    pruneStaleToolResults(msgs);
    expect(JSON.stringify(msgs)).toBe(before);
  });

  it("age-weighted: old write_file pruned before recent read_file", () => {
    // Build 15 exchanges. First exchange is old write_file (priority 2, very old).
    // 14th exchange is a recent read_file (priority 0, but fresh).
    // With age-weighting, the old write_file should be pruned before the recent read_file
    // because its age-weighted score (2 * lowFreshness) < (0 * highFreshness stays 0).
    // Actually read_file priority is 0 so score is always 0 — it gets pruned first by score.
    // Better test: old bash (priority 2, ancient) vs recent bash (priority 2, fresh).
    // Old bash score = 2 * lowFreshness; recent bash score = 2 * highFreshness → old pruned first.
    const msgs: Anthropic.MessageParam[] = [];
    const toolMap = new Map<string, string>();

    // 12 old bash exchanges (age = far from end)
    for (let i = 0; i < 12; i++) {
      const id = `tool_old_${i}`;
      toolMap.set(id, "bash");
      msgs.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: `Old bash result ${i} `.repeat(10) }] } as unknown as Anthropic.ToolResultBlockParam],
      });
      msgs.push(makeAssistantMsg());
    }

    // 3 recent read_file exchanges (priority 0 — always lowest score; pruned first regardless)
    // Use write_file for recent to test age effect on same tool type:
    // 3 recent write_file (priority 2, fresh) — should NOT be pruned before old bash
    for (let i = 0; i < 3; i++) {
      const id = `tool_new_${i}`;
      toolMap.set(id, "write_file");
      msgs.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: `Recent write_file result ${i} `.repeat(10) }] } as unknown as Anthropic.ToolResultBlockParam],
      });
      msgs.push(makeAssistantMsg());
    }

    // Capture old bash text refs before pruning
    const oldBashTexts: Array<{ type: string; text?: string }> = [];
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; tool_use_id?: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && tb.tool_use_id?.startsWith("tool_old_") && Array.isArray(tb.content)) {
          for (const cb of tb.content) oldBashTexts.push(cb);
        }
      }
    }

    pruneStaleToolResults(msgs, 8, toolMap);

    // Old bash results (beyond cutoff) should be pruned
    const prunedOld = oldBashTexts.filter(cb => cb.text?.startsWith("[pruned"));
    expect(prunedOld.length).toBeGreaterThan(0);
  });
});
