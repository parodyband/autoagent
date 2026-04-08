/**
 * Tests for /find and /model TUI command logic.
 *
 * We test the pure parsing/routing logic extracted from tui.tsx handlers
 * without spinning up React/Ink.
 */

import { describe, it, expect } from "vitest";

// ─── /model command parsing ───────────────────────────────────

const MODEL_ALIASES: Record<string, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
};

function parseModelArg(arg: string): { resolved: string | null; error?: string } {
  if (!arg) return { resolved: null }; // no-arg: show current
  const resolved =
    MODEL_ALIASES[arg] ?? (arg.startsWith("claude-") ? arg : null);
  if (!resolved) {
    return { resolved: null, error: `Unknown model "${arg}". Use: haiku, sonnet, opus, or a full model ID.` };
  }
  return { resolved };
}

describe("/model command parsing", () => {
  it("no arg returns null resolved (show-current case)", () => {
    const r = parseModelArg("");
    expect(r.resolved).toBeNull();
    expect(r.error).toBeUndefined();
  });

  it("/model haiku resolves to claude-haiku-4-5", () => {
    const r = parseModelArg("haiku");
    expect(r.resolved).toBe("claude-haiku-4-5");
    expect(r.error).toBeUndefined();
  });

  it("/model sonnet resolves to claude-sonnet-4-6", () => {
    const r = parseModelArg("sonnet");
    expect(r.resolved).toBe("claude-sonnet-4-6");
    expect(r.error).toBeUndefined();
  });

  it("/model with full model ID passes through", () => {
    const r = parseModelArg("claude-opus-4-6");
    expect(r.resolved).toBe("claude-opus-4-6");
  });

  it("/model with unknown alias returns error", () => {
    const r = parseModelArg("gpt4");
    expect(r.resolved).toBeNull();
    expect(r.error).toMatch(/Unknown model/);
  });
});

// ─── /find command parsing ────────────────────────────────────

function parseFindArg(trimmed: string): { query: string | null; error?: string } {
  const query = trimmed.slice(5).trim(); // remove "/find"
  if (!query) return { query: null, error: "Usage: /find <query>" };
  return { query };
}

describe("/find command parsing", () => {
  it("no query returns usage error", () => {
    const r = parseFindArg("/find");
    expect(r.query).toBeNull();
    expect(r.error).toBe("Usage: /find <query>");
  });

  it("/find with query extracts the query string", () => {
    const r = parseFindArg("/find buildRepoMap");
    expect(r.query).toBe("buildRepoMap");
    expect(r.error).toBeUndefined();
  });

  it("/find with multi-word query extracts full string", () => {
    const r = parseFindArg("/find auto load context");
    expect(r.query).toBe("auto load context");
  });

  it("/find with leading spaces in query trims correctly", () => {
    const r = parseFindArg("/find   fuzzySearch");
    expect(r.query).toBe("fuzzySearch");
  });
});

// ─── fuzzySearch integration (via tree-sitter-map) ───────────

import { fuzzySearch, type RepoMap } from "../tree-sitter-map.js";

describe("fuzzySearch used by /find command", () => {
  const sampleMap: RepoMap = {
    files: [
      {
        path: "src/orchestrator.ts",
        exports: [
          { name: "Orchestrator", kind: "class", line: 10, exported: true },
          { name: "send", kind: "function", line: 50, exported: true },
        ],
        imports: [],
      },
      {
        path: "src/context-loader.ts",
        exports: [
          { name: "autoLoadContext", kind: "function", line: 5, exported: true },
        ],
        imports: [],
      },
    ],
  };

  it("returns matches for a known symbol name", () => {
    const results = fuzzySearch(sampleMap, "autoLoadContext", 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toBe("src/context-loader.ts");
  });

  it("returns empty array for nonsense query", () => {
    const results = fuzzySearch(sampleMap, "xyzzy_nonexistent_zz", 10);
    expect(results.length).toBe(0);
  });

  it("matches by file path substring", () => {
    const results = fuzzySearch(sampleMap, "orchestrator", 10);
    expect(results.some(r => r.file.includes("orchestrator"))).toBe(true);
  });

  it("respects limit parameter", () => {
    const results = fuzzySearch(sampleMap, "src", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ─── /model reset command ─────────────────────────────────────

import { Orchestrator } from "../orchestrator.js";

describe("/model reset via resetModelOverride()", () => {
  it("getModel() returns 'auto' when no override is set", () => {
    const orc = new Orchestrator({ workDir: "/tmp" });
    expect(orc.getModel()).toBe("auto");
  });

  it("setModel() then resetModelOverride() restores auto", () => {
    const orc = new Orchestrator({ workDir: "/tmp" });
    orc.setModel("claude-haiku-4-5");
    expect(orc.getModel()).toBe("claude-haiku-4-5");
    orc.resetModelOverride();
    expect(orc.getModel()).toBe("auto");
  });

  it("resetModelOverride() is equivalent to setModel(null)", () => {
    const orc = new Orchestrator({ workDir: "/tmp" });
    orc.setModel("claude-sonnet-4-6");
    orc.resetModelOverride();
    expect(orc.getModel()).toBe("auto");
  });
});

// ─── /tools command logic ─────────────────────────────────────

// Pure helper: parse /tools args and return the subcommand token
function parseToolsArgs(input: string): { sub: string; query: string | null } {
  const args = input.replace(/^\/tools\s*/, "").trim();
  if (args === "stats") return { sub: "stats", query: null };
  if (args.startsWith("search ")) {
    const query = args.slice(7).trim();
    return { sub: "search", query: query || null };
  }
  if (args === "search") return { sub: "search", query: null };
  return { sub: "list", query: null };
}

describe("/tools command parsing", () => {
  it("/tools with no args routes to list", () => {
    const r = parseToolsArgs("/tools");
    expect(r.sub).toBe("list");
    expect(r.query).toBeNull();
  });

  it("/tools stats routes to stats subcommand", () => {
    const r = parseToolsArgs("/tools stats");
    expect(r.sub).toBe("stats");
    expect(r.query).toBeNull();
  });

  it("/tools search <query> extracts the query", () => {
    const r = parseToolsArgs("/tools search bash_execute");
    expect(r.sub).toBe("search");
    expect(r.query).toBe("bash_execute");
  });

  it("/tools search with no query signals usage error", () => {
    const r = parseToolsArgs("/tools search");
    expect(r.sub).toBe("search");
    expect(r.query).toBeNull();
  });

  it("/tools search with multi-word query extracts full string", () => {
    const r = parseToolsArgs("/tools search read file");
    expect(r.sub).toBe("search");
    expect(r.query).toBe("read file");
  });
});

// ─── /branch command logic ────────────────────────────────────

function parseBranchArgs(input: string): { sub: string; name: string | null } {
  const args = input.replace(/^\/branch\s*/, "").trim();
  const parts = args.split(/\s+/);
  const sub = parts[0] || "list";
  const name = parts[1] ?? null;
  return { sub, name };
}

describe("/branch command parsing", () => {
  it("/branch with no args routes to list", () => {
    const r = parseBranchArgs("/branch");
    expect(r.sub).toBe("list");
    expect(r.name).toBeNull();
  });

  it("/branch list routes to list", () => {
    const r = parseBranchArgs("/branch list");
    expect(r.sub).toBe("list");
  });

  it("/branch save <name> extracts name", () => {
    const r = parseBranchArgs("/branch save my-branch");
    expect(r.sub).toBe("save");
    expect(r.name).toBe("my-branch");
  });

  it("/branch restore <name> extracts name", () => {
    const r = parseBranchArgs("/branch restore checkpoint-1");
    expect(r.sub).toBe("restore");
    expect(r.name).toBe("checkpoint-1");
  });

  it("/branch restore with no name signals usage error (null name)", () => {
    const r = parseBranchArgs("/branch restore");
    expect(r.sub).toBe("restore");
    expect(r.name).toBeNull();
  });
});
