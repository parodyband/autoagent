import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoLoadContext, extractKeywords } from "../context-loader.js";
import type { RepoMap } from "../tree-sitter-map.js";
import * as fs from "fs";

// Mock fs.readFileSync
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

const mockReadFileSync = vi.mocked(fs.readFileSync);

function makeRepoMap(files: { path: string; symbols?: string[] }[]): RepoMap {
  return {
    files: files.map(f => ({
      path: f.path,
      exports: (f.symbols ?? []).map((name, i) => ({
        name,
        kind: "function" as const,
        line: i + 1,
        exported: true,
      })),
      imports: [],
    })),
  };
}

describe("extractKeywords", () => {
  it("filters stopwords", () => {
    const kw = extractKeywords("fix the bug in the code");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("fix");  // "fix" is a stopword in our list
    expect(kw).toContain("bug");
  });

  it("filters words shorter than 3 chars", () => {
    const kw = extractKeywords("do it now");
    expect(kw).not.toContain("do");
    expect(kw).not.toContain("it");
  });

  it("deduplicates keywords", () => {
    const kw = extractKeywords("button button component");
    const buttonCount = kw.filter(w => w === "button").length;
    expect(buttonCount).toBe(1);
  });

  it("lowercases keywords", () => {
    const kw = extractKeywords("Button Component");
    expect(kw).toContain("button");
    expect(kw).toContain("component");
  });
});

describe("autoLoadContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string when repo map has no files", () => {
    const repoMap: RepoMap = { files: [] };
    const result = autoLoadContext(repoMap, "fix the Button", "/workspace");
    expect(result).toBe("");
  });

  it("returns empty string when no keywords match", () => {
    const repoMap = makeRepoMap([{ path: "src/xyz.ts", symbols: ["xyz"] }]);
    // "do it" — all stopwords/short words, no match
    const result = autoLoadContext(repoMap, "do it", "/workspace");
    expect(result).toBe("");
  });

  it("skips very short keywords (< 3 chars)", () => {
    const repoMap = makeRepoMap([{ path: "src/ab.ts", symbols: ["ab"] }]);
    mockReadFileSync.mockReturnValue("content" as unknown as Buffer);
    // "ab" is 2 chars — should be skipped
    const result = autoLoadContext(repoMap, "ab", "/workspace");
    expect(result).toBe("");
  });

  it("returns file contents for matching keywords", () => {
    const repoMap = makeRepoMap([
      { path: "src/Button.tsx", symbols: ["Button", "ButtonProps"] },
    ]);
    mockReadFileSync.mockReturnValue("export function Button() {}" as unknown as Buffer);
    const result = autoLoadContext(repoMap, "refactor the Button component", "/workspace");
    expect(result).toContain("[Auto-loaded context]");
    expect(result).toContain("src/Button.tsx");
    expect(result).toContain("export function Button()");
  });

  it("returns max 3 files even if more match", () => {
    const repoMap = makeRepoMap([
      { path: "src/alpha.ts", symbols: ["alpha"] },
      { path: "src/beta.ts", symbols: ["beta"] },
      { path: "src/gamma.ts", symbols: ["gamma"] },
      { path: "src/delta.ts", symbols: ["delta"] },
    ]);
    mockReadFileSync.mockReturnValue("content" as unknown as Buffer);
    // All 4 files have names that would match their own keywords
    const result = autoLoadContext(
      repoMap,
      "alpha beta gamma delta",
      "/workspace",
    );
    const matches = (result.match(/--- file:/g) ?? []).length;
    expect(matches).toBeLessThanOrEqual(3);
  });

  it("deduplicates files that match multiple keywords", () => {
    const repoMap = makeRepoMap([
      { path: "src/Button.tsx", symbols: ["Button", "ButtonProps"] },
    ]);
    mockReadFileSync.mockReturnValue("export function Button() {}" as unknown as Buffer);
    // "button" and "buttonprops" both match same file
    const result = autoLoadContext(repoMap, "Button ButtonProps", "/workspace");
    // Should appear only once
    const matches = (result.match(/--- file: src\/Button\.tsx/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it("respects the 32000 char budget (truncates)", () => {
    const repoMap = makeRepoMap([
      { path: "src/large.ts", symbols: ["largeFunction"] },
    ]);
    // Create a string much larger than 32000 chars
    const bigContent = "x".repeat(40_000);
    mockReadFileSync.mockReturnValue(bigContent as unknown as Buffer);
    const result = autoLoadContext(repoMap, "largeFunction refactor", "/workspace");
    expect(result.length).toBeLessThanOrEqual(32_500); // small overhead for headers
  });

  it("skips files already mentioned in conversation", () => {
    const repoMap = makeRepoMap([
      { path: "src/Button.tsx", symbols: ["Button"] },
    ]);
    mockReadFileSync.mockReturnValue("export function Button() {}" as unknown as Buffer);
    const alreadyMentioned = new Set(["src/Button.tsx"]);
    const result = autoLoadContext(
      repoMap,
      "refactor Button component",
      "/workspace",
      alreadyMentioned,
    );
    expect(result).not.toContain("src/Button.tsx");
  });

  it("skips unreadable files gracefully", () => {
    const repoMap = makeRepoMap([
      { path: "src/Button.tsx", symbols: ["Button"] },
      { path: "src/Input.tsx", symbols: ["Input"] },
    ]);
    // First file throws, second succeeds
    mockReadFileSync
      .mockImplementationOnce(() => { throw new Error("ENOENT"); })
      .mockReturnValue("export function Input() {}" as unknown as Buffer);
    const result = autoLoadContext(repoMap, "Button Input refactor", "/workspace");
    expect(result).not.toContain("src/Button.tsx");
    expect(result).toContain("src/Input.tsx");
  });
});
