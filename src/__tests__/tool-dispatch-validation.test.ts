import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../tool-registry.js";

function makeRegistry() {
  const registry = new ToolRegistry();
  registry.register(
    {
      name: "test_tool",
      description: "A test tool",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" }, count: { type: "number" } },
        required: ["path"],
      },
    },
    async () => "ok"
  );
  registry.register(
    {
      name: "no_required_tool",
      description: "A tool with no required params",
      input_schema: { type: "object", properties: { optional: { type: "string" } }, required: [] },
    },
    async () => "ok"
  );
  registry.register(
    {
      name: "no_schema_tool",
      description: "A tool with empty schema",
      input_schema: { type: "object" },
    },
    async () => "ok"
  );
  return registry;
}

// Mirrors the validation logic in orchestrator.ts dispatch site
function validateToolInput(
  registry: ToolRegistry,
  toolName: string,
  input: Record<string, unknown>
): string | null {
  const fullSchema = registry.getSchemaFor(toolName);
  if (!fullSchema) return null;

  const required = (fullSchema.required as string[] | undefined) ?? [];
  const properties =
    (fullSchema.properties as Record<string, { type?: string }> | undefined) ?? {};

  const missing = required.filter((k) => !(k in input));
  const wrongType = Object.entries(properties)
    .filter(([k, def]) => def.type && k in input && typeof input[k] !== def.type)
    .map(([k, def]) => `${k} (expected ${def.type}, got ${typeof input[k]})`);

  if (missing.length > 0 || wrongType.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing required parameters: ${missing.join(", ")}`);
    if (wrongType.length > 0) parts.push(`wrong parameter types: ${wrongType.join("; ")}`);
    return `[Validation error] ${parts.join(" | ")}`;
  }
  return null;
}

describe("tool dispatch validation", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = makeRegistry();
  });

  it("returns error when required param is missing", () => {
    const err = validateToolInput(registry, "test_tool", {});
    expect(err).not.toBeNull();
    expect(err).toContain("missing required parameters: path");
  });

  it("returns error when param has wrong type", () => {
    const err = validateToolInput(registry, "test_tool", { path: "/foo", count: "not-a-number" });
    expect(err).not.toBeNull();
    expect(err).toContain("wrong parameter types");
    expect(err).toContain("count (expected number, got string)");
  });

  it("returns null for valid input", () => {
    const err = validateToolInput(registry, "test_tool", { path: "/foo" });
    expect(err).toBeNull();
  });

  it("returns null for valid input with optional param also provided", () => {
    const err = validateToolInput(registry, "test_tool", { path: "/foo", count: 42 });
    expect(err).toBeNull();
  });

  it("returns null for unknown tool — validation skipped", () => {
    const err = validateToolInput(registry, "unknown_tool", { anything: true });
    expect(err).toBeNull();
  });

  it("always passes validation for tool with no required params", () => {
    const err = validateToolInput(registry, "no_required_tool", {});
    expect(err).toBeNull();
  });

  it("always passes validation for tool with empty schema", () => {
    const err = validateToolInput(registry, "no_schema_tool", {});
    expect(err).toBeNull();
  });

  it("combines missing and wrong-type errors in same message", () => {
    registry.register(
      {
        name: "multi_tool",
        description: "multi",
        input_schema: {
          type: "object",
          properties: { name: { type: "string" }, size: { type: "number" } },
          required: ["name", "size"],
        },
      },
      async () => "ok"
    );
    // Missing "name", wrong type for "size"
    const err = validateToolInput(registry, "multi_tool", { size: "big" });
    expect(err).not.toBeNull();
    expect(err).toContain("missing required parameters: name");
    expect(err).toContain("wrong parameter types");
    expect(err).toContain("size (expected number, got string)");
  });

  it("getSchemaFor returns undefined for unregistered tool", () => {
    const schema = registry.getSchemaFor("nonexistent");
    expect(schema).toBeUndefined();
  });
});
