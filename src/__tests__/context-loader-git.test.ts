import { describe, it, expect, vi, afterEach } from "vitest";
import { getRecentlyChangedFiles } from "../context-loader.js";

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
});
