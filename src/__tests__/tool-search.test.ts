import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../tool-registry.js";
import type { ToolContext, ToolResult } from "../tool-registry.js";

function noopHandler(_input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
  return Promise.resolve({ result: "ok" });
}

function makeTool(name: string, description: string) {
  return {
    name,
    description,
    input_schema: { type: "object" as const, properties: {} },
  };
}

let registry: ToolRegistry;

beforeEach(() => {
  registry = new ToolRegistry();
});

// ─── hidden flag ─────────────────────────────────────────────

describe("hidden tools", () => {
  it("hidden tools excluded from getDefinitions()", () => {
    registry.register(makeTool("visible_tool", "A visible tool"), noopHandler);
    registry.register(makeTool("hidden_tool", "A hidden tool"), noopHandler, { hidden: true });

    const defs = registry.getDefinitions();
    expect(defs.map((d) => d.name)).toContain("visible_tool");
    expect(defs.map((d) => d.name)).not.toContain("hidden_tool");
  });

  it("hidden tools included in getAllDefinitions()", () => {
    registry.register(makeTool("visible_tool", "A visible tool"), noopHandler);
    registry.register(makeTool("hidden_tool", "A hidden tool"), noopHandler, { hidden: true });

    const defs = registry.getAllDefinitions();
    expect(defs.map((d) => d.name)).toContain("visible_tool");
    expect(defs.map((d) => d.name)).toContain("hidden_tool");
  });

  it("hidden tools are still callable via get()", () => {
    registry.register(makeTool("hidden_tool", "A hidden tool"), noopHandler, { hidden: true });
    expect(registry.get("hidden_tool")).toBeDefined();
  });

  it("non-hidden tools appear in getDefinitions()", () => {
    registry.register(makeTool("tool_a", "First tool"), noopHandler);
    registry.register(makeTool("tool_b", "Second tool"), noopHandler);
    expect(registry.getDefinitions()).toHaveLength(2);
  });
});

// ─── searchTools ─────────────────────────────────────────────

describe("searchTools", () => {
  beforeEach(() => {
    registry.register(makeTool("read_file", "Read file contents from disk"), noopHandler);
    registry.register(makeTool("write_file", "Write file contents to disk"), noopHandler);
    registry.register(makeTool("bash", "Execute a bash command"), noopHandler);
    registry.register(makeTool("web_fetch", "Fetch a URL from the web"), noopHandler);
    registry.register(
      makeTool("secret_tool", "Internal diagnostics tool"),
      noopHandler,
      { hidden: true }
    );
  });

  it("returns empty array for no matches", () => {
    expect(registry.searchTools("zzznomatch")).toHaveLength(0);
  });

  it('searchTools("file") returns file-related tools', () => {
    const results = registry.searchTools("file");
    const names = results.map((r) => r.definition.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).not.toContain("bash");
  });

  it('searchTools("bash") returns bash tool', () => {
    const results = registry.searchTools("bash");
    expect(results).toHaveLength(1);
    expect(results[0].definition.name).toBe("bash");
  });

  it("includes hidden tools in search results", () => {
    const results = registry.searchTools("secret");
    const names = results.map((r) => r.definition.name);
    expect(names).toContain("secret_tool");
  });

  it("matches against description", () => {
    const results = registry.searchTools("disk");
    const names = results.map((r) => r.definition.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
  });

  it("exact name match scores highest", () => {
    const results = registry.searchTools("bash");
    expect(results[0].definition.name).toBe("bash");
  });

  it("case-insensitive search", () => {
    const results = registry.searchTools("FILE");
    const names = results.map((r) => r.definition.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
  });
});
