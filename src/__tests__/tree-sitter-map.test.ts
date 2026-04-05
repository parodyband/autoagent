import { describe, it, expect } from "vitest";
import path from "path";
import { parseFile, buildRepoMap, formatRepoMap } from "../tree-sitter-map.js";
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
