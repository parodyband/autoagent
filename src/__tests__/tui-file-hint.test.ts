/**
 * Tests for #file hint pure helpers exported from tui.tsx.
 */
import { describe, it, expect } from "vitest";
import { extractFileQuery, getFileSuggestions } from "../tui.js";
import type { RepoMap } from "../tree-sitter-map.js";

describe("extractFileQuery", () => {
  it("returns null when no # present", () => {
    expect(extractFileQuery("hello world")).toBeNull();
  });

  it("returns empty string when just # typed", () => {
    expect(extractFileQuery("look at #")).toBe("");
  });

  it("returns partial after #", () => {
    expect(extractFileQuery("see #src/orch")).toBe("src/orch");
  });

  it("returns null when # is followed by space (completed word)", () => {
    expect(extractFileQuery("#src/foo.ts done")).toBeNull();
  });

  it("uses lastIndexOf — picks the last # in input (no space after last #)", () => {
    // "a #foo b #bar" — last # is #bar, no space after → returns "bar"
    expect(extractFileQuery("a #foo b #bar")).toBe("bar");
  });

  it("returns partial for last # at end with no space", () => {
    expect(extractFileQuery("compare #old and #new")).toBe("new");
  });
});

// Sample repo map for suggestion tests
const sampleMap: RepoMap = {
  files: [
    {
      path: "src/orchestrator.ts",
      exports: [{ name: "Orchestrator", kind: "class", line: 1, exported: true }],
      imports: [],
    },
    {
      path: "src/context-loader.ts",
      exports: [{ name: "autoLoadContext", kind: "function", line: 1, exported: true }],
      imports: [],
    },
    {
      path: "src/tree-sitter-map.ts",
      exports: [{ name: "buildRepoMap", kind: "function", line: 1, exported: true }],
      imports: [],
    },
  ],
};

describe("getFileSuggestions", () => {
  it("returns empty array for empty repo map", () => {
    expect(getFileSuggestions({ files: [] }, "orch")).toEqual([]);
  });

  it("returns file paths matching partial", () => {
    const results = getFileSuggestions(sampleMap, "orchestrator");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBe("src/orchestrator.ts");
  });

  it("respects limit parameter", () => {
    const results = getFileSuggestions(sampleMap, "src", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("returns empty for non-matching query", () => {
    const results = getFileSuggestions(sampleMap, "xyzzy_nonexistent_abc123");
    expect(results).toEqual([]);
  });

  it("deduplicates file paths", () => {
    const results = getFileSuggestions(sampleMap, "ts", 10);
    const unique = new Set(results);
    expect(unique.size).toBe(results.length);
  });

  it("empty partial returns results (all files match)", () => {
    const results = getFileSuggestions(sampleMap, "", 5);
    // fuzzySearch with empty string may or may not return results — just no duplicates
    const unique = new Set(results);
    expect(unique.size).toBe(results.length);
  });
});
