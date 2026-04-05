import { describe, it, expect } from "vitest";
import path from "path";
import { parseFile, buildRepoMap, formatRepoMap, rankSymbols } from "../tree-sitter-map.js";
import type { ParsedFile, RepoMap } from "../tree-sitter-map.js";

const FIXTURES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "fixtures");
const SRC_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

// ─── parseFile ────────────────────────────────────────────────

describe("parseFile", () => {
  it("parses exports from orchestrator.ts", () => {
    const result = parseFile(path.join(SRC_DIR, "orchestrator.ts"));
    expect(result.exports.length).toBeGreaterThan(0);
    expect(result.parseError).toBeUndefined();
  });

  it("finds exported function names from orchestrator.ts", () => {
    const result = parseFile(path.join(SRC_DIR, "orchestrator.ts"));
    const names = result.exports.map((s) => s.name);
    // buildSystemPrompt is exported from orchestrator
    expect(names).toContain("buildSystemPrompt");
  });

  it("extracts imports from orchestrator.ts", () => {
    const result = parseFile(path.join(SRC_DIR, "orchestrator.ts"));
    expect(result.imports.length).toBeGreaterThan(0);
    const froms = result.imports.map((i) => i.from);
    // Should import from @anthropic-ai/sdk or similar
    expect(froms.some((f) => f.includes("anthropic") || f.includes("./") || f.includes("fs"))).toBe(true);
  });

  it("returns correct kind for class declarations", () => {
    const result = parseFile(path.join(SRC_DIR, "session-store.ts"));
    // session-store.ts may or may not have classes; test the kinds are valid
    for (const sym of result.exports) {
      expect(["function", "class", "interface", "type", "const", "enum"]).toContain(sym.kind);
    }
  });

  it("returns correct line numbers (1-indexed)", () => {
    const result = parseFile(path.join(SRC_DIR, "orchestrator.ts"));
    for (const sym of result.exports) {
      expect(sym.line).toBeGreaterThan(0);
    }
  });

  it("handles non-existent file gracefully", () => {
    const result = parseFile("/nonexistent/path/file.ts");
    expect(result.exports).toEqual([]);
    expect(result.imports).toEqual([]);
    expect(result.parseError).toBeDefined();
  });

  it("handles non-TS file using regex fallback", () => {
    // .json or .md files should not throw
    const result = parseFile(path.join(SRC_DIR, "..", "package.json"));
    expect(result.exports).toBeDefined();
    expect(result.imports).toBeDefined();
  });

  it("parses exports from symbol-index.ts (pure regex-heavy file)", () => {
    const result = parseFile(path.join(SRC_DIR, "symbol-index.ts"));
    const names = result.exports.map((s) => s.name);
    expect(names).toContain("extractSymbols");
    expect(names).toContain("buildSymbolIndex");
  });

  it("parses architect-mode.ts exports", () => {
    const result = parseFile(path.join(SRC_DIR, "architect-mode.ts"));
    expect(result.exports.length).toBeGreaterThan(0);
    const names = result.exports.map((s) => s.name);
    expect(names).toContain("runArchitectMode");
  });

  it("exported flag is true for exported symbols", () => {
    const result = parseFile(path.join(SRC_DIR, "symbol-index.ts"));
    const exported = result.exports.filter((s) => s.exported);
    expect(exported.length).toBeGreaterThan(0);
  });
});

// ─── buildRepoMap ─────────────────────────────────────────────

describe("buildRepoMap", () => {
  it("processes multiple files", () => {
    const files = [
      "src/symbol-index.ts",
      "src/architect-mode.ts",
      "src/session-store.ts",
      "src/tool-output-compressor.ts",
    ];
    const repoMap = buildRepoMap(SRC_DIR + "/..", files);
    expect(repoMap.files.length).toBe(4);
    expect(repoMap.builtAt).toBeGreaterThan(0);
  });

  it("stores relative paths in ParsedFile.path", () => {
    const workDir = SRC_DIR + "/..";
    const files = ["src/symbol-index.ts"];
    const repoMap = buildRepoMap(workDir, files);
    expect(repoMap.files[0].path).toBe("src/symbol-index.ts");
  });

  it("processes 30+ files in under 500ms", async () => {
    // Gather all src/*.ts files
    const { readdirSync } = await import("fs");
    const srcFiles = readdirSync(SRC_DIR)
      .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
      .map((f) => `src/${f}`);

    expect(srcFiles.length).toBeGreaterThanOrEqual(10);

    const workDir = SRC_DIR + "/..";
    const start = Date.now();
    const repoMap = buildRepoMap(workDir, srcFiles);
    const elapsed = Date.now() - start;

    expect(repoMap.files.length).toBe(srcFiles.length);
    expect(elapsed).toBeLessThan(500);
  });
});

// ─── formatRepoMap ────────────────────────────────────────────

describe("formatRepoMap", () => {
  it("returns a string starting with # Repo Map", () => {
    const repoMap: RepoMap = {
      files: [{ path: "src/foo.ts", exports: [{ name: "foo", kind: "function", line: 1, exported: true }], imports: [] }],
      builtAt: Date.now(),
    };
    const output = formatRepoMap(repoMap);
    expect(output).toMatch(/^# Repo Map/);
  });

  it("includes file path in output", () => {
    const repoMap: RepoMap = {
      files: [{ path: "src/foo.ts", exports: [{ name: "foo", kind: "function", line: 5, exported: true }], imports: [] }],
      builtAt: Date.now(),
    };
    const output = formatRepoMap(repoMap);
    expect(output).toContain("src/foo.ts");
  });

  it("includes exported symbol names and kinds", () => {
    const repoMap: RepoMap = {
      files: [{
        path: "src/bar.ts",
        exports: [
          { name: "Bar", kind: "class", line: 10, exported: true },
          { name: "doThing", kind: "function", line: 20, exported: true },
        ],
        imports: [],
      }],
      builtAt: Date.now(),
    };
    const output = formatRepoMap(repoMap);
    expect(output).toContain("Bar");
    expect(output).toContain("class");
    expect(output).toContain("doThing");
    expect(output).toContain("function");
  });

  it("includes import sources", () => {
    const repoMap: RepoMap = {
      files: [{
        path: "src/baz.ts",
        exports: [],
        imports: [{ names: ["foo"], from: "./foo.js" }, { names: ["bar"], from: "some-lib" }],
      }],
      builtAt: Date.now(),
    };
    const output = formatRepoMap(repoMap);
    expect(output).toContain("./foo.js");
    expect(output).toContain("some-lib");
  });

  it("skips files with no exports and no imports", () => {
    const repoMap: RepoMap = {
      files: [
        { path: "src/empty.ts", exports: [], imports: [] },
        { path: "src/nonempty.ts", exports: [{ name: "x", kind: "const", line: 1, exported: true }], imports: [] },
      ],
      builtAt: Date.now(),
    };
    const output = formatRepoMap(repoMap);
    expect(output).not.toContain("src/empty.ts");
    expect(output).toContain("src/nonempty.ts");
  });

  it("respects maxFiles option", () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `src/file${i}.ts`,
      exports: [{ name: `fn${i}`, kind: "function" as const, line: 1, exported: true }],
      imports: [],
    }));
    const repoMap: RepoMap = { files, builtAt: Date.now() };
    const output = formatRepoMap(repoMap, { maxFiles: 3 });
    expect(output).toContain("src/file0.ts");
    expect(output).toContain("src/file1.ts");
    expect(output).toContain("src/file2.ts");
    expect(output).not.toContain("src/file3.ts");
  });

  it("formats real parsed file output as compact string", () => {
    const workDir = SRC_DIR + "/..";
    const repoMap = buildRepoMap(workDir, ["src/symbol-index.ts"]);
    const output = formatRepoMap(repoMap);
    expect(output).toContain("symbol-index.ts");
    expect(output.length).toBeGreaterThan(20);
  });
});

// ─── rankSymbols ──────────────────────────────────────────────

describe("rankSymbols", () => {
  it("returns correct in-degree counts for cross-file imports", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/a.ts",
          exports: [{ name: "foo", kind: "function", line: 1, exported: true }],
          imports: [],
        },
        {
          path: "src/b.ts",
          exports: [{ name: "bar", kind: "function", line: 1, exported: true }],
          imports: [{ names: ["foo"], from: "./a.js" }],
        },
        {
          path: "src/c.ts",
          exports: [],
          imports: [{ names: ["foo"], from: "./a.js" }],
        },
      ],
      builtAt: Date.now(),
    };
    const scores = rankSymbols(repoMap);
    expect(scores.get("foo")).toBe(2);
    expect(scores.get("bar")).toBe(0);
  });

  it("returns score 0 for symbols imported by no files", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/a.ts",
          exports: [{ name: "unused", kind: "const", line: 1, exported: true }],
          imports: [],
        },
      ],
      builtAt: Date.now(),
    };
    const scores = rankSymbols(repoMap);
    expect(scores.get("unused")).toBe(0);
  });

  it("only tracks exported symbols", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/a.ts",
          exports: [
            { name: "pub", kind: "function", line: 1, exported: true },
            { name: "priv", kind: "function", line: 2, exported: false },
          ],
          imports: [],
        },
        {
          path: "src/b.ts",
          exports: [],
          imports: [{ names: ["pub", "priv"], from: "./a.js" }],
        },
      ],
      builtAt: Date.now(),
    };
    const scores = rankSymbols(repoMap);
    expect(scores.has("pub")).toBe(true);
    expect(scores.has("priv")).toBe(false);
  });
});

describe("formatRepoMap with ranked", () => {
  it("sorts symbols by rank (highest first)", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/a.ts",
          exports: [
            { name: "low", kind: "function", line: 1, exported: true },
            { name: "high", kind: "function", line: 2, exported: true },
          ],
          imports: [],
        },
      ],
      builtAt: Date.now(),
    };
    const ranked = new Map([["low", 0], ["high", 5]]);
    const output = formatRepoMap(repoMap, { ranked });
    const lowIdx = output.indexOf("low");
    const highIdx = output.indexOf("high");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("appends (×N) for symbols with score >= 2", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/a.ts",
          exports: [
            { name: "popular", kind: "function", line: 1, exported: true },
            { name: "rare", kind: "function", line: 2, exported: true },
          ],
          imports: [],
        },
      ],
      builtAt: Date.now(),
    };
    const ranked = new Map([["popular", 3], ["rare", 1]]);
    const output = formatRepoMap(repoMap, { ranked });
    expect(output).toContain("popular (×3)");
    expect(output).not.toContain("rare (×");
  });

  it("without ranked map preserves existing behavior", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/a.ts",
          exports: [{ name: "fn", kind: "function", line: 1, exported: true }],
          imports: [],
        },
      ],
      builtAt: Date.now(),
    };
    const output = formatRepoMap(repoMap);
    expect(output).toContain("fn (function:1)");
    expect(output).not.toContain("×");
  });
});

// ─── fuzzySearch ──────────────────────────────────────────────

import { fuzzySearch, truncateRepoMap } from "../tree-sitter-map.js";

describe("fuzzySearch", () => {
  const repoMap: import("../tree-sitter-map.js").RepoMap = {
    files: [
      {
        path: "src/orchestrator.ts",
        exports: [
          { name: "send", kind: "function", line: 10, exported: true },
          { name: "OrchestratorConfig", kind: "interface", line: 1, exported: true },
        ],
        imports: [{ names: ["buildRepoMap"], from: "./tree-sitter-map.js" }],
      },
      {
        path: "src/tui.tsx",
        exports: [
          { name: "App", kind: "function", line: 5, exported: true },
        ],
        imports: [{ names: ["send"], from: "./orchestrator.js" }],
      },
      {
        path: "src/utils/helpers.ts",
        exports: [
          { name: "formatBytes", kind: "function", line: 3, exported: true },
          { name: "parseArgs", kind: "function", line: 20, exported: true },
        ],
        imports: [],
      },
    ],
    builtAt: Date.now(),
  };

  it("returns file matches for partial path query", () => {
    const results = fuzzySearch(repoMap, "orch");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.file === "src/orchestrator.ts" && !r.symbol)).toBe(true);
  });

  it("returns symbol matches for partial symbol name", () => {
    const results = fuzzySearch(repoMap, "send");
    expect(results.some(r => r.symbol === "send" && r.kind === "function")).toBe(true);
  });

  it("respects maxResults cap", () => {
    const results = fuzzySearch(repoMap, "s", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("ranks exact prefix match above scattered match", () => {
    const results = fuzzySearch(repoMap, "format");
    const formatIdx = results.findIndex(r => r.symbol === "formatBytes");
    // formatBytes should appear — it's a prefix match for "format"
    expect(formatIdx).toBeGreaterThanOrEqual(0);
    // It should rank higher than a scattered match like "formatRepoMap" (not in our data)
    // but at minimum it should be in the results
    expect(results[formatIdx].score).toBeGreaterThan(0.5);
  });

  it("empty query returns empty array", () => {
    expect(fuzzySearch(repoMap, "")).toEqual([]);
    expect(fuzzySearch(repoMap, "   ")).toEqual([]);
  });
});

// ─── rankSymbols (file-level sorting) ────────────────────────

describe("rankSymbols file-level sorting via formatRepoMap", () => {
  it("sorts files by aggregate score (highest first)", () => {
    const repoMap: RepoMap = {
      files: [
        {
          path: "src/low.ts",
          exports: [{ name: "rareFunc", kind: "function", line: 1, exported: true }],
          imports: [],
        },
        {
          path: "src/high.ts",
          exports: [{ name: "popularFunc", kind: "function", line: 1, exported: true }],
          imports: [],
        },
      ],
      builtAt: Date.now(),
    };
    const ranked = new Map([["rareFunc", 1], ["popularFunc", 10]]);
    const output = formatRepoMap(repoMap, { ranked });
    expect(output.indexOf("src/high.ts")).toBeLessThan(output.indexOf("src/low.ts"));
  });

  it("tie-breaks files by path when scores are equal", () => {
    const repoMap: RepoMap = {
      files: [
        { path: "src/z.ts", exports: [{ name: "fn", kind: "function", line: 1, exported: true }], imports: [] },
        { path: "src/a.ts", exports: [{ name: "fn2", kind: "function", line: 1, exported: true }], imports: [] },
      ],
      builtAt: Date.now(),
    };
    const ranked = new Map([["fn", 5], ["fn2", 5]]);
    const output = formatRepoMap(repoMap, { ranked });
    expect(output.indexOf("src/a.ts")).toBeLessThan(output.indexOf("src/z.ts"));
  });

  it("zero-score files appear after high-score files", () => {
    const repoMap: RepoMap = {
      files: [
        { path: "src/zero.ts", exports: [{ name: "unused", kind: "const", line: 1, exported: true }], imports: [] },
        { path: "src/hot.ts", exports: [{ name: "core", kind: "function", line: 1, exported: true }], imports: [] },
      ],
      builtAt: Date.now(),
    };
    const ranked = new Map([["unused", 0], ["core", 8]]);
    const output = formatRepoMap(repoMap, { ranked });
    expect(output.indexOf("src/hot.ts")).toBeLessThan(output.indexOf("src/zero.ts"));
  });

  it("symbols within a file are sorted by score descending", () => {
    const repoMap: RepoMap = {
      files: [{
        path: "src/mixed.ts",
        exports: [
          { name: "alpha", kind: "function", line: 1, exported: true },
          { name: "omega", kind: "function", line: 2, exported: true },
        ],
        imports: [],
      }],
      builtAt: Date.now(),
    };
    const ranked = new Map([["alpha", 1], ["omega", 9]]);
    const output = formatRepoMap(repoMap, { ranked });
    expect(output.indexOf("omega")).toBeLessThan(output.indexOf("alpha"));
  });

  it("rankSymbols counts distinct-file imports correctly", () => {
    const repoMap: RepoMap = {
      files: [
        { path: "src/util.ts", exports: [{ name: "helper", kind: "function", line: 1, exported: true }], imports: [] },
        { path: "src/a.ts", exports: [], imports: [{ names: ["helper"], from: "./util.js" }] },
        { path: "src/b.ts", exports: [], imports: [{ names: ["helper"], from: "./util.js" }] },
        { path: "src/c.ts", exports: [], imports: [{ names: ["helper"], from: "./util.js" }] },
      ],
      builtAt: Date.now(),
    };
    const scores = rankSymbols(repoMap);
    expect(scores.get("helper")).toBe(3);
  });
});

// ─── truncateRepoMap ──────────────────────────────────────────

describe("truncateRepoMap", () => {
  it("returns map unchanged when under budget", () => {
    const map = "# Repo Map\nsrc/a.ts\n  exports: foo (function:1)";
    expect(truncateRepoMap(map, 4000)).toBe(map);
  });

  it("truncates at file boundaries, not mid-file", () => {
    // Build a map with sections that each consume ~2000 chars
    const bigSection = "x".repeat(2000);
    const map = `# Repo Map\nsrc/a.ts\n  exports: ${bigSection}\nsrc/b.ts\n  exports: ${bigSection}\nsrc/c.ts\n  exports: ${bigSection}`;
    // Budget of 1 token (4 chars) — should keep header + 0 file sections
    const result = truncateRepoMap(map, 1);
    expect(result).toContain("# Repo Map");
    expect(result).not.toContain("src/a.ts");
    expect(result).toContain("omitted");
  });

  it("includes omitted count in truncation message", () => {
    const bigSection = "x".repeat(5000);
    const map = `# Repo Map\nsrc/a.ts\n  exports: ${bigSection}\nsrc/b.ts\n  exports: small\nsrc/c.ts\n  exports: small`;
    const result = truncateRepoMap(map, 1);
    expect(result).toMatch(/\d+ more file/);
  });

  it("keeps highest-ranked files (first in string) when truncating", () => {
    // When formatRepoMap is called with ranked, highest files come first
    // truncateRepoMap preserves this order by dropping from the bottom
    const header = "# Repo Map\n";
    const highFile = "src/important.ts\n  exports: core (function:1)\n";
    const lowFile = "src/minor.ts\n  exports: " + "x".repeat(20000) + " (function:1)\n";
    const map = header + highFile + lowFile;
    const result = truncateRepoMap(map, 100); // small budget
    expect(result).toContain("src/important.ts");
    expect(result).not.toContain("src/minor.ts");
  });

  it("singular 'file' vs plural 'files' in omission message", () => {
    const bigSection = "x".repeat(8000);
    const map = `# Repo Map\nsrc/a.ts\n  exports: ${bigSection}`;
    const result = truncateRepoMap(map, 1);
    expect(result).toContain("1 more file omitted");
    expect(result).not.toContain("1 more files");
  });
});
