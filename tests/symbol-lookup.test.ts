/**
 * Tests for symbolLookup() in context-loader.ts and
 * findFilesBySymbol() in tree-sitter-map.ts (iter 318 features).
 */

import { describe, it, expect } from "vitest";
import { symbolLookup } from "../src/context-loader.js";
import { findFilesBySymbol } from "../src/tree-sitter-map.js";
import type { RepoMap } from "../src/tree-sitter-map.js";

// ── Minimal RepoMap factory ──────────────────────────────────────────────────

function makeRepoMap(files: Array<{ path: string; exports: Array<{ name: string; kind: string }> }>): RepoMap {
  return {
    files: files.map(f => ({
      path: f.path,
      exports: f.exports.map(e => ({ name: e.name, kind: e.kind, line: 1 })),
      imports: [],
      size: 100,
      lastModified: Date.now(),
      pageRank: 1,
    })),
    generatedAt: Date.now(),
    workDir: "/test",
  };
}

// ── findFilesBySymbol tests ──────────────────────────────────────────────────

describe("findFilesBySymbol", () => {
  it("returns file containing exact symbol match", () => {
    const repoMap = makeRepoMap([
      { path: "src/foo.ts", exports: [{ name: "FooClass", kind: "class" }] },
      { path: "src/bar.ts", exports: [{ name: "barFn", kind: "function" }] },
    ]);

    const results = findFilesBySymbol(repoMap, "FooClass");
    expect(results).toContain("src/foo.ts");
    expect(results).not.toContain("src/bar.ts");
  });

  it("returns empty array when symbol does not exist", () => {
    const repoMap = makeRepoMap([
      { path: "src/foo.ts", exports: [{ name: "FooClass", kind: "class" }] },
    ]);

    const results = findFilesBySymbol(repoMap, "NonExistent");
    expect(results).toEqual([]);
  });

  it("returns multiple files if same symbol appears in multiple files", () => {
    const repoMap = makeRepoMap([
      { path: "src/a.ts", exports: [{ name: "shared", kind: "function" }] },
      { path: "src/b.ts", exports: [{ name: "shared", kind: "function" }] },
    ]);

    const results = findFilesBySymbol(repoMap, "shared");
    expect(results).toHaveLength(2);
    expect(results).toContain("src/a.ts");
    expect(results).toContain("src/b.ts");
  });

  it("sorts results with higher-priority kinds first (class/function > const)", () => {
    const repoMap = makeRepoMap([
      { path: "src/constants.ts", exports: [{ name: "mySymbol", kind: "const" }] },
      { path: "src/main.ts", exports: [{ name: "mySymbol", kind: "function" }] },
    ]);

    const results = findFilesBySymbol(repoMap, "mySymbol");
    expect(results[0]).toBe("src/main.ts");   // function (priority 3) before const (priority 1)
    expect(results[1]).toBe("src/constants.ts");
  });

  it("is case-sensitive — does not match partial names", () => {
    const repoMap = makeRepoMap([
      { path: "src/foo.ts", exports: [{ name: "FooClass", kind: "class" }] },
    ]);

    expect(findFilesBySymbol(repoMap, "fooClass")).toEqual([]);
    expect(findFilesBySymbol(repoMap, "Foo")).toEqual([]);
  });
});

// ── symbolLookup tests ───────────────────────────────────────────────────────

describe("symbolLookup", () => {
  it("returns defining file for exact symbol match keyword", () => {
    const repoMap = makeRepoMap([
      { path: "src/orchestrator.ts", exports: [{ name: "Orchestrator", kind: "class" }] },
    ]);

    const results = symbolLookup(["Orchestrator"], repoMap);
    expect(results).toContain("src/orchestrator.ts");
  });

  it("returns empty array when no keywords match any symbol", () => {
    const repoMap = makeRepoMap([
      { path: "src/foo.ts", exports: [{ name: "FooBar", kind: "function" }] },
    ]);

    const results = symbolLookup(["unrelated", "words"], repoMap);
    expect(results).toEqual([]);
  });

  it("de-duplicates files across multiple matching keywords", () => {
    const repoMap = makeRepoMap([
      { path: "src/utils.ts", exports: [
        { name: "utilA", kind: "function" },
        { name: "utilB", kind: "function" },
      ]},
    ]);

    // Both keywords resolve to the same file — should appear only once
    const results = symbolLookup(["utilA", "utilB"], repoMap);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("src/utils.ts");
  });

  it("collects files from multiple distinct matching keywords", () => {
    const repoMap = makeRepoMap([
      { path: "src/a.ts", exports: [{ name: "Alpha", kind: "class" }] },
      { path: "src/b.ts", exports: [{ name: "Beta", kind: "function" }] },
    ]);

    const results = symbolLookup(["Alpha", "Beta", "unmatched"], repoMap);
    expect(results).toContain("src/a.ts");
    expect(results).toContain("src/b.ts");
    expect(results).toHaveLength(2);
  });

  it("returns empty array for empty keywords list", () => {
    const repoMap = makeRepoMap([
      { path: "src/foo.ts", exports: [{ name: "Foo", kind: "class" }] },
    ]);
    expect(symbolLookup([], repoMap)).toEqual([]);
  });
});
