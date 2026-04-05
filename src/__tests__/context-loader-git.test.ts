import { describe, it, expect, vi, afterEach } from "vitest";
import { getRecentlyChangedFiles, filterByRepoMap, getRecentCommitFiles, autoLoadContext } from "../context-loader.js";

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

describe("getRecentCommitFiles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns files from recent commits", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(
      "abc1234 fix something\nsrc/foo.ts\nsrc/bar.ts\n\ndef5678 another commit\nsrc/baz.ts\n" as unknown as Buffer
    );
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentCommitFiles("/fake");
    expect(result).toContain("src/foo.ts");
    expect(result).toContain("src/bar.ts");
    expect(result).toContain("src/baz.ts");
  });

  it("deduplicates files that appear in multiple commits", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(
      "abc1234 commit one\nsrc/shared.ts\n\ndef5678 commit two\nsrc/shared.ts\n" as unknown as Buffer
    );
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentCommitFiles("/fake");
    expect(result.filter(f => f === "src/shared.ts")).toHaveLength(1);
  });

  it("filters binary extensions", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(
      "abc1234 add assets\nassets/image.png\nsrc/code.ts\n" as unknown as Buffer
    );
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getRecentCommitFiles("/fake");
    expect(result).not.toContain("assets/image.png");
    expect(result).toContain("src/code.ts");
  });

  it("filters files that no longer exist on disk", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(
      "abc1234 deleted\nsrc/deleted.ts\nsrc/present.ts\n" as unknown as Buffer
    );
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).includes("present.ts"));
    const result = getRecentCommitFiles("/fake");
    expect(result).not.toContain("src/deleted.ts");
    expect(result).toContain("src/present.ts");
  });

  it("returns empty array when not a git repo", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => { throw new Error("not a git repo"); });
    const result = getRecentCommitFiles("/fake");
    expect(result).toEqual([]);
  });

  it("respects custom limit parameter", () => {
    vi.mocked(childProcess.execSync).mockReturnValue("" as unknown as Buffer);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    getRecentCommitFiles("/fake", 5);
    const call = vi.mocked(childProcess.execSync).mock.calls[0][0] as string;
    expect(call).toContain("-5");
  });
});

describe("autoLoadContext git-log tier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes git-log files in tier 2 (between git-diff and keyword results)", () => {
    // git diff returns one file, git log returns a different file
    vi.mocked(childProcess.execSync).mockImplementation((cmd: unknown) => {
      const c = cmd as string;
      if (c.includes("git log")) {
        return "abc1234 recent commit\nsrc/log-file.ts\n" as unknown as Buffer;
      }
      // git diff (staged and unstaged)
      return "src/diff-file.ts\n" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const filePath = p as string;
      if (filePath.includes("log-file")) return "log file content" as unknown as Buffer;
      if (filePath.includes("diff-file")) return "diff file content" as unknown as Buffer;
      return "" as unknown as Buffer;
    });

    const repoMap = {
      files: [
        { path: "src/diff-file.ts", exports: [{ name: "diffFunc", kind: "function", line: 1 }], size: 100, mtime: 0 },
        { path: "src/log-file.ts", exports: [{ name: "logFunc", kind: "function", line: 1 }], size: 100, mtime: 0 },
      ],
    };
    const result = autoLoadContext(repoMap as any, "fix the diffFunc and logFunc", "/fake");
    expect(result).toContain("log-file.ts");
    expect(result).toContain("diff-file.ts");
  });

  it("excludes git-log files already in alreadyMentioned", () => {
    vi.mocked(childProcess.execSync).mockImplementation((cmd: unknown) => {
      const c = cmd as string;
      if (c.includes("git log")) {
        return "abc1234 recent commit\nsrc/already-known.ts\nsrc/new-file.ts\n" as unknown as Buffer;
      }
      return "" as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("content" as unknown as Buffer);

    const repoMap = {
      files: [
        { path: "src/already-known.ts", exports: [{ name: "knownFunc", kind: "function", line: 1 }], size: 100, mtime: 0 },
        { path: "src/new-file.ts", exports: [{ name: "newFunc", kind: "function", line: 1 }], size: 100, mtime: 0 },
      ],
    };
    const alreadyMentioned = new Set(["src/already-known.ts"]);
    const result = autoLoadContext(repoMap as any, "fix knownFunc and newFunc", "/fake", alreadyMentioned);
    expect(result).not.toContain("already-known.ts");
    expect(result).toContain("new-file.ts");
  });

  it("git-log files don't duplicate git-diff files", () => {
    const sharedFile = "src/shared.ts";
    vi.mocked(childProcess.execSync).mockImplementation((cmd: unknown) => {
      const c = cmd as string;
      if (c.includes("git log")) {
        return `abc1234 recent\n${sharedFile}\n` as unknown as Buffer;
      }
      // git diff also returns same file
      return `${sharedFile}\n` as unknown as Buffer;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("shared content" as unknown as Buffer);

    const repoMap = { files: [{ path: sharedFile, exports: [{ name: "sharedFunc", kind: "function", line: 1 }], size: 100, mtime: 0 }] };
    const result = autoLoadContext(repoMap, "fix sharedFunc", "/fake");
    // File should appear only once in output
    const occurrences = (result.match(/shared\.ts/g) ?? []).length;
    expect(occurrences).toBe(1);
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
