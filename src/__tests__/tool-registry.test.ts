import { describe, it, expect, vi } from "vitest";
import { ToolRegistry, createDefaultRegistry } from "../tool-registry.js";
import type { ToolContext } from "../tool-registry.js";

// ─── ToolRegistry class ──────────────────────────────────────

describe("ToolRegistry", () => {
  it("starts empty", () => {
    const registry = new ToolRegistry();
    expect(registry.size()).toBe(0);
  });

  it("registers a tool and retrieves it by name", () => {
    const registry = new ToolRegistry();
    const handler = vi.fn();
    const definition = {
      name: "my_tool",
      description: "A test tool",
      input_schema: { type: "object" as const, properties: {} },
    };
    registry.register(definition, handler);
    expect(registry.has("my_tool")).toBe(true);
    expect(registry.get("my_tool")).toBeDefined();
    expect(registry.get("my_tool")!.definition.name).toBe("my_tool");
  });

  it("returns undefined for unknown tool name", () => {
    const registry = new ToolRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("has() returns false for unregistered tools", () => {
    const registry = new ToolRegistry();
    expect(registry.has("ghost")).toBe(false);
  });

  it("getNames() returns all registered tool names", () => {
    const registry = new ToolRegistry();
    const def = (name: string) => ({
      name,
      description: name,
      input_schema: { type: "object" as const, properties: {} },
    });
    registry.register(def("tool_a"), vi.fn());
    registry.register(def("tool_b"), vi.fn());
    const names = registry.getNames();
    expect(names).toContain("tool_a");
    expect(names).toContain("tool_b");
    expect(names.length).toBe(2);
  });

  it("getDefinitions() returns all tool definitions", () => {
    const registry = new ToolRegistry();
    const def = (name: string) => ({
      name,
      description: name,
      input_schema: { type: "object" as const, properties: {} },
    });
    registry.register(def("tool_x"), vi.fn());
    const defs = registry.getDefinitions();
    expect(defs.length).toBe(1);
    expect(defs[0].name).toBe("tool_x");
  });

  it("size() returns the number of registered tools", () => {
    const registry = new ToolRegistry();
    const def = (name: string) => ({
      name,
      description: name,
      input_schema: { type: "object" as const, properties: {} },
    });
    registry.register(def("t1"), vi.fn());
    registry.register(def("t2"), vi.fn());
    registry.register(def("t3"), vi.fn());
    expect(registry.size()).toBe(3);
  });

  it("stores the defaultTimeout from options", () => {
    const registry = new ToolRegistry();
    const def = {
      name: "slow_tool",
      description: "slow",
      input_schema: { type: "object" as const, properties: {} },
    };
    registry.register(def, vi.fn(), { defaultTimeout: 90 });
    expect(registry.getTimeout("slow_tool")).toBe(90);
  });

  it("getTimeout() returns undefined when no timeout set", () => {
    const registry = new ToolRegistry();
    const def = {
      name: "fast_tool",
      description: "fast",
      input_schema: { type: "object" as const, properties: {} },
    };
    registry.register(def, vi.fn());
    expect(registry.getTimeout("fast_tool")).toBeUndefined();
  });

  it("dispatches a tool call by invoking the handler", async () => {
    const registry = new ToolRegistry();
    const handler = vi.fn().mockResolvedValue({ result: "ok" });
    const def = {
      name: "echo_tool",
      description: "echo",
      input_schema: { type: "object" as const, properties: {} },
    };
    registry.register(def, handler);

    const ctx: ToolContext = { rootDir: "/tmp", log: vi.fn() };
    const tool = registry.get("echo_tool")!;
    const result = await tool.handler({ message: "hello" }, ctx);
    expect(result.result).toBe("ok");
    expect(handler).toHaveBeenCalledWith({ message: "hello" }, ctx);
  });
});

// ─── createDefaultRegistry ───────────────────────────────────

describe("createDefaultRegistry", () => {
  it("registers the expected standard tools", () => {
    const registry = createDefaultRegistry();
    const names = registry.getNames();
    expect(names).toContain("bash");
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("grep");
    expect(names).toContain("web_fetch");
    expect(names).toContain("think");
    expect(names).toContain("list_files");
    expect(names).toContain("subagent");
  });

  it("registers at least 8 tools", () => {
    const registry = createDefaultRegistry();
    expect(registry.size()).toBeGreaterThanOrEqual(8);
  });

  it("all registered tools have definitions with names", () => {
    const registry = createDefaultRegistry();
    for (const def of registry.getDefinitions()) {
      expect(typeof def.name).toBe("string");
      expect(def.name.length).toBeGreaterThan(0);
    }
  });

  it("all registered tools have handlers", () => {
    const registry = createDefaultRegistry();
    for (const name of registry.getNames()) {
      const tool = registry.get(name);
      expect(tool).toBeDefined();
      expect(typeof tool!.handler).toBe("function");
    }
  });

  it("bash tool has a defaultTimeout set", () => {
    const registry = createDefaultRegistry();
    expect(registry.getTimeout("bash")).toBeDefined();
    expect(registry.getTimeout("bash")).toBeGreaterThan(0);
  });

  it("think tool handler returns a result without side effects", async () => {
    const registry = createDefaultRegistry();
    const tool = registry.get("think")!;
    const ctx: ToolContext = { rootDir: "/tmp", log: vi.fn() };
    const result = await tool.handler({ thought: "test thought" }, ctx);
    expect(result.result).toContain("thought".toLowerCase().replace("t", "T") || "Thought");
  });

  it("save_memory tool is registered", () => {
    const registry = createDefaultRegistry();
    expect(registry.has("save_memory")).toBe(true);
  });

  it("save_memory tool has required key and value parameters", () => {
    const registry = createDefaultRegistry();
    const tool = registry.get("save_memory")!;
    const schema = tool.definition.input_schema as { properties: Record<string, unknown>; required: string[] };
    expect(schema.properties).toHaveProperty("key");
    expect(schema.properties).toHaveProperty("value");
    expect(schema.required).toContain("key");
    expect(schema.required).toContain("value");
  });

  it("save_memory tool writes to .autoagent.md in workDir", async () => {
    const { mkdtempSync, rmSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(tmpdir() + "/autoagent-test-");
    try {
      const registry = createDefaultRegistry();
      const tool = registry.get("save_memory")!;
      const ctx: ToolContext = { rootDir: tmpDir, log: vi.fn() };
      const result = await tool.handler({ key: "test key", value: "test value" }, ctx);
      expect(result.result).toContain("test key");
      const { readFileSync } = await import("fs");
      const content = readFileSync(tmpDir + "/.autoagent.md", "utf-8");
      expect(content).toContain("test key");
      expect(content).toContain("test value");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
