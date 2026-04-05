import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, statSync } from "fs";
import path from "path";
import os from "os";
import {
  saveRepoMapCache,
  loadRepoMapCache,
  getStaleFiles,
  updateRepoMapIncremental,
  cacheToRepoMap,
  buildRepoMap,
  type RepoMap,
} from "../src/tree-sitter-map.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "autoagent-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeFile(name: string, content = "export const x = 1;"): string {
  const p = path.join(tmpDir, name);
  writeFileSync(p, content, "utf-8");
  return p;
}

describe("saveRepoMapCache / loadRepoMapCache", () => {
  it("round-trips a repo map to disk", () => {
    const f = makeFile("a.ts");
    const repoMap = buildRepoMap(tmpDir, [f]);
    saveRepoMapCache(tmpDir, repoMap);

    const cache = loadRepoMapCache(tmpDir);
    expect(cache).not.toBeNull();
    expect(cache!.files.length).toBe(1);
    expect(cache!.files[0].path).toBe("a.ts");
    expect(typeof cache!.files[0].lastModified).toBe("number");
    expect(cache!.generatedAt).toBeGreaterThan(0);
  });

  it("returns null when no cache file exists (cache miss)", () => {
    const result = loadRepoMapCache(tmpDir);
    expect(result).toBeNull();
  });

  it("stores lastModified matching file mtime", () => {
    const f = makeFile("b.ts");
    const mtime = statSync(f).mtimeMs;
    const repoMap = buildRepoMap(tmpDir, [f]);
    saveRepoMapCache(tmpDir, repoMap);

    const cache = loadRepoMapCache(tmpDir);
    expect(cache!.files[0].lastModified).toBe(mtime);
  });
});

describe("getStaleFiles", () => {
  it("returns empty array when all files are fresh", () => {
    const f = makeFile("c.ts");
    const repoMap = buildRepoMap(tmpDir, [f]);
    saveRepoMapCache(tmpDir, repoMap);
    const cache = loadRepoMapCache(tmpDir)!;

    const stale = getStaleFiles(tmpDir, cache, ["c.ts"]);
    expect(stale).toHaveLength(0);
  });

  it("detects a stale file after modification", async () => {
    const f = makeFile("d.ts", "export const a = 1;");
    const repoMap = buildRepoMap(tmpDir, [f]);
    saveRepoMapCache(tmpDir, repoMap);
    const cache = loadRepoMapCache(tmpDir)!;

    // Modify the file (ensure mtime changes)
    await new Promise(r => setTimeout(r, 10));
    writeFileSync(f, "export const a = 2;", "utf-8");

    const stale = getStaleFiles(tmpDir, cache, ["d.ts"]);
    expect(stale).toContain("d.ts");
  });

  it("marks a new file (not in cache) as stale", () => {
    const f = makeFile("e.ts");
    const repoMap = buildRepoMap(tmpDir, [f]);
    saveRepoMapCache(tmpDir, repoMap);
    const cache = loadRepoMapCache(tmpDir)!;

    const newFile = makeFile("f.ts");
    const stale = getStaleFiles(tmpDir, cache, ["e.ts", path.relative(tmpDir, newFile)]);
    expect(stale).toContain(path.relative(tmpDir, newFile));
  });
});

describe("updateRepoMapIncremental", () => {
  it("re-parses only changed files and merges with cached", () => {
    const f1 = makeFile("g.ts", "export const g1 = 1;");
    const f2 = makeFile("h.ts", "export const h1 = 2;");
    const original = buildRepoMap(tmpDir, [f1, f2]);

    // Modify f2
    writeFileSync(f2, "export const h1Updated = 99;", "utf-8");

    const updated = updateRepoMapIncremental(tmpDir, original, [f2]);
    expect(updated.files).toHaveLength(2);

    const h = updated.files.find(f => f.path === "h.ts");
    expect(h).toBeDefined();
    const names = h!.exports.map(e => e.name);
    expect(names).toContain("h1Updated");
    expect(names).not.toContain("h1");
  });

  it("returns original map unchanged when changedFiles is empty", () => {
    const f = makeFile("i.ts");
    const original = buildRepoMap(tmpDir, [f]);
    const result = updateRepoMapIncremental(tmpDir, original, []);
    expect(result).toBe(original);
  });
});

describe("cacheToRepoMap", () => {
  it("converts cache to RepoMap stripping lastModified", () => {
    const f = makeFile("j.ts");
    const repoMap = buildRepoMap(tmpDir, [f]);
    saveRepoMapCache(tmpDir, repoMap);
    const cache = loadRepoMapCache(tmpDir)!;
    const converted = cacheToRepoMap(cache);

    expect(converted.builtAt).toBe(cache.generatedAt);
    expect((converted.files[0] as Record<string, unknown>)["lastModified"]).toBeUndefined();
  });
});
