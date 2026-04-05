import { describe, it, expect, vi } from "vitest";
import { PARALLEL_SAFE_TOOLS } from "../orchestrator.js";

// Test the PARALLEL_SAFE_TOOLS constant
describe("PARALLEL_SAFE_TOOLS", () => {
  it("includes expected read-only tools", () => {
    expect(PARALLEL_SAFE_TOOLS.has("read_file")).toBe(true);
    expect(PARALLEL_SAFE_TOOLS.has("grep")).toBe(true);
    expect(PARALLEL_SAFE_TOOLS.has("glob")).toBe(true);
    expect(PARALLEL_SAFE_TOOLS.has("web_search")).toBe(true);
    expect(PARALLEL_SAFE_TOOLS.has("web_fetch")).toBe(true);
    expect(PARALLEL_SAFE_TOOLS.has("list_files")).toBe(true);
  });

  it("excludes side-effecting tools", () => {
    expect(PARALLEL_SAFE_TOOLS.has("write_file")).toBe(false);
    expect(PARALLEL_SAFE_TOOLS.has("bash")).toBe(false);
    expect(PARALLEL_SAFE_TOOLS.has("save_memory")).toBe(false);
    expect(PARALLEL_SAFE_TOOLS.has("subagent")).toBe(false);
  });
});

// Test parallel execution behavior via a mock executeToolsParallel-like harness
describe("parallel execution ordering", () => {
  it("multiple read-only tools execute and results are in original order", async () => {
    const order: number[] = [];
    // Simulate 3 read_file calls with varying delays
    const tools = [
      { id: "1", name: "read_file", input: { path: "a.ts" } },
      { id: "2", name: "read_file", input: { path: "b.ts" } },
      { id: "3", name: "read_file", input: { path: "c.ts" } },
    ];

    const delays = [30, 10, 20]; // b finishes first, then c, then a
    const results = await Promise.all(
      tools.map(async (tu, i) => {
        await new Promise(r => setTimeout(r, delays[i]));
        order.push(i);
        return { type: "tool_result" as const, tool_use_id: tu.id, content: `content-${i}` };
      }),
    );

    // Promise.all preserves original order regardless of completion order
    expect(results[0].tool_use_id).toBe("1");
    expect(results[1].tool_use_id).toBe("2");
    expect(results[2].tool_use_id).toBe("3");
    expect(results[0].content).toBe("content-0");
    // Execution order was b(1), c(2), a(0) due to delays
    expect(order).toEqual([1, 2, 0]);
  });

  it("mixed read-only and sequential tools: parallel-safe identified correctly", () => {
    const mixed = ["read_file", "bash", "grep", "write_file", "list_files"];
    const parallel = mixed.filter(n => PARALLEL_SAFE_TOOLS.has(n));
    const sequential = mixed.filter(n => !PARALLEL_SAFE_TOOLS.has(n));

    expect(parallel).toEqual(["read_file", "grep", "list_files"]);
    expect(sequential).toEqual(["bash", "write_file"]);
  });

  it("results maintain original order when execution completes out of order", async () => {
    const tools = [
      { id: "slow", name: "read_file" },
      { id: "fast", name: "grep" },
    ];
    const resultsArr: Array<{ tool_use_id: string; content: string }> = new Array(2);
    const completionOrder: string[] = [];

    await Promise.all(
      tools.map(async (tu, idx) => {
        const delay = tu.id === "slow" ? 50 : 5;
        await new Promise(r => setTimeout(r, delay));
        completionOrder.push(tu.id);
        resultsArr[idx] = { tool_use_id: tu.id, content: `result-${tu.id}` };
      }),
    );

    // fast completed first
    expect(completionOrder[0]).toBe("fast");
    // but results are in original order
    expect(resultsArr[0].tool_use_id).toBe("slow");
    expect(resultsArr[1].tool_use_id).toBe("fast");
  });
});
