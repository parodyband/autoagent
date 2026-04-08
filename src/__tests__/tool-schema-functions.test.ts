import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../tool-registry.js";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Helpers ─────────────────────────────────────────────────

function makeSchema(
  properties: Record<string, { type?: string; description?: string }>,
  required?: string[],
): Anthropic.Tool["input_schema"] {
  return {
    type: "object" as const,
    properties,
    ...(required ? { required } : {}),
  };
}

function makeTool(
  name: string,
  description: string,
  schema: Anthropic.Tool["input_schema"],
): Anthropic.Tool {
  return { name, description, input_schema: schema };
}

// ─── schemaToSignature (tested via getMinimalDefinitions output) ──────────

describe("schemaToSignature (via getMinimalDefinitions)", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("includes required and optional params with correct labels", () => {
    registry.register(
      makeTool(
        "my_tool",
        "Does something",
        makeSchema(
          { url: { type: "string" }, extract_text: { type: "boolean" } },
          ["url"],
        ),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const desc = defs[0].description ?? "";
    expect(desc).toContain("url (string, required)");
    expect(desc).toContain("extract_text (boolean)");
    // optional param should NOT have ", required"
    expect(desc).not.toMatch(/extract_text \(boolean, required\)/);
  });

  it("returns empty signature for tool with no properties", () => {
    registry.register(
      makeTool("no_params", "No params tool", { type: "object" as const }),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const desc = defs[0].description ?? "";
    // Should just be the plain description, no "Params:" prefix
    expect(desc).toBe("No params tool");
  });

  it("handles nested object params — shows type as object", () => {
    registry.register(
      makeTool(
        "nested_tool",
        "Nested",
        makeSchema({ config: { type: "object" } }, ["config"]),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const desc = defs[0].description ?? "";
    expect(desc).toContain("config (object, required)");
  });

  it("handles array-type params — shows type as array", () => {
    registry.register(
      makeTool(
        "array_tool",
        "Array tool",
        makeSchema({ items: { type: "array" } }),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const desc = defs[0].description ?? "";
    expect(desc).toContain("items (array)");
  });

  it("falls back to 'any' when param type is missing", () => {
    registry.register(
      makeTool(
        "untyped_tool",
        "Untyped",
        makeSchema({ mystery: {} }),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const desc = defs[0].description ?? "";
    expect(desc).toContain("mystery (any)");
  });

  it("prepends signature before description when params exist", () => {
    registry.register(
      makeTool(
        "combo_tool",
        "Does combo things",
        makeSchema({ x: { type: "number" } }, ["x"]),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const desc = defs[0].description ?? "";
    // Signature line should come first, then description
    expect(desc).toMatch(/^Params:/);
    expect(desc).toContain("Does combo things");
    const sigIndex = desc.indexOf("Params:");
    const descIndex = desc.indexOf("Does combo things");
    expect(sigIndex).toBeLessThan(descIndex);
  });
});

// ─── getMinimalDefinitions ────────────────────────────────────

describe("getMinimalDefinitions", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("returns array of tools with name and description", () => {
    registry.register(
      makeTool("tool_a", "Tool A", makeSchema({ q: { type: "string" } }, ["q"])),
      async () => ({ result: "" }),
    );
    registry.register(
      makeTool("tool_b", "Tool B", makeSchema({ n: { type: "number" } })),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs[0].name).toBe("tool_a");
    expect(defs[1].name).toBe("tool_b");
    expect(typeof defs[0].description).toBe("string");
    expect(typeof defs[1].description).toBe("string");
  });

  it("omits input_schema property details — only bare object type returned", () => {
    registry.register(
      makeTool(
        "rich_tool",
        "Rich schema",
        makeSchema({ a: { type: "string" }, b: { type: "number" } }, ["a"]),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    const schema = defs[0].input_schema as Record<string, unknown>;
    // Should be a bare { type: "object" } — no properties key
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeUndefined();
    expect(schema.required).toBeUndefined();
  });

  it("excludes hidden tools", () => {
    registry.register(
      makeTool("visible", "Visible tool", { type: "object" as const }),
      async () => ({ result: "" }),
    );
    registry.register(
      makeTool("secret", "Hidden tool", { type: "object" as const }),
      async () => ({ result: "" }),
      { hidden: true },
    );

    const defs = registry.getMinimalDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("visible");
    expect(defs.find((d) => d.name === "secret")).toBeUndefined();
  });

  it("matches expected snapshot format for a known tool shape", () => {
    registry.register(
      makeTool(
        "bash",
        "Execute a bash command and return its output.",
        makeSchema(
          { command: { type: "string" }, timeout: { type: "number" } },
          ["command"],
        ),
      ),
      async () => ({ result: "" }),
    );

    const defs = registry.getMinimalDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      name: "bash",
      input_schema: { type: "object" },
    });
    expect(defs[0].description).toContain("command (string, required)");
    expect(defs[0].description).toContain("timeout (number)");
    expect(defs[0].description).toContain("Execute a bash command");
  });
});
