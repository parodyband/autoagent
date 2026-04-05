import { describe, it, expect, vi, afterEach } from "vitest";
import { getRecentlyChangedFiles, filterByRepoMap } from "../context-loader.js";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(),
}));

import * as childProcess from "child_process";
import * as fs from "fs";

describe("getRecentlyChangedFiles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unstaged changed files", () => {
    vi.mocked(childProcess.execSync).mockImplementation((cmd: unknown) => {
      const c = cmd as string;
      if (c.includes("--cached")) return "" as unknown as Buffer;
      return "src/foo.ts\nsrc/bar.ts\n" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentlyChangedFiles("/fake");
    expect(result).toContain("src/foo.ts");
    expect(result).toContain("src/bar.ts");
  });

  it("returns staged changed files", () => {
    vi.mocked(childProcess.execSync).mockImplementation((cmd: unknown) => {
      const c = cmd as string;
      if (c.includes("--cached")) return "src/staged.ts\n" as unknown as Buffer;
      return "" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentlyChangedFiles("/fake");
    expect(result).toContain("src/staged.ts");
  });

  it("deduplicates files that appear in both staged and unstaged", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      return "src/both.ts\n" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentlyChangedFiles("/fake");
    expect(result.filter(f => f === "src/both.ts")).toHaveLength(1);
  });

  it("returns empty array when not a git repo", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error("not a git repository");
    });
    const result = getRecentlyChangedFiles("/fake");
    expect(result).toEqual([]);
  });

  it("filters out binary files by extension", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      return "assets/logo.png\nsrc/code.ts\n" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentlyChangedFiles("/fake");
    expect(result).not.toContain("assets/logo.png");
    expect(result).toContain("src/code.ts");
  });

  it("filters out files that no longer exist on disk", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      return "src/deleted.ts\nsrc/exists.ts\n" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes("exists.ts");
    });
    const result = getRecentlyChangedFiles("/fake");
    expect(result).not.toContain("src/deleted.ts");
    expect(result).toContain("src/exists.ts");
  });

  it("filters to knownFiles set when provided", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      return "src/foo.ts\npackage-lock.json\nsrc/bar.ts\n" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const knownFiles = new Set(["src/foo.ts"]);
    const result = getRecentlyChangedFiles("/fake", knownFiles);
    expect(result).toContain("src/foo.ts");
    expect(result).not.toContain("package-lock.json");
    expect(result).not.toContain("src/bar.ts");
  });
});

describe("filterByRepoMap", () => {
  it("keeps files present in repo map", () => {
    const files = ["src/foo.ts", "src/bar.ts"];
    const repoMapFiles = new Set(["src/foo.ts", "src/bar.ts"]);
    expect(filterByRepoMap(files, repoMapFiles)).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  it("excludes files not in repo map", () => {
    const files = ["src/foo.ts", "src/unknown.ts"];
    const repoMapFiles = new Set(["src/foo.ts"]);
    const result = filterByRepoMap(files, repoMapFiles);
    expect(result).toContain("src/foo.ts");
    expect(result).not.toContain("src/unknown.ts");
  });

  it("always excludes lock files even if in repo map set", () => {
    const files = ["package-lock.json", "src/app.ts"];
    const repoMapFiles = new Set(["src/app.ts"]);
    const result = filterByRepoMap(files, repoMapFiles);
    expect(result).not.toContain("package-lock.json");
    expect(result).toContain("src/app.ts");
  });

  it("returns all files when repo map set is empty", () => {
    const files = ["src/foo.ts", "src/bar.ts"];
    const result = filterByRepoMap(files, new Set());
    expect(result).toEqual(["src/foo.ts", "src/bar.ts"]);
  });
});
