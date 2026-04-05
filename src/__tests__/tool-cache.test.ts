import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { extractPaths, pathOverlaps, ToolCache, CACHEABLE_TOOLS } from "../tool-cache.js";

// ─── extractPaths ────────────────────────────────────────────────────────────

describe("extractPaths", () => {
  it("returns normalized path for read_file", () => {
    const result = extractPaths("read_file", { path: "src/foo.ts" });
    expect(result).toEqual([path.normalize("src/foo.ts")]);
  });

  it("returns normalized path for grep", () => {
    const result = extractPaths("grep", { path: "src/" });
    expect(result).toEqual([path.normalize("src/")]);
  });

  it("returns normalized path for list_files", () => {
    const result = extractPaths("list_files", { path: "src" });
    expect(result).toEqual([path.normalize("src")]);
  });

  it("returns empty array when no path in input", () => {
    const result = extractPaths("read_file", { pattern: "hello" });
    expect(result).toEqual([]);
  });

  it("returns empty array for unknown tool", () => {
    const result = extractPaths("write_file", { path: "src/foo.ts" });
    expect(result).toEqual([]);
  });

  it("normalizes path separators", () => {
    const result = extractPaths("read_file", { path: "src//foo/../bar.ts" });
    expect(result).toEqual([path.normalize("src//foo/../bar.ts")]);
  });
});

// ─── pathOverlaps ─────────────────────────────────────────────────────────────

describe("pathOverlaps", () => {
  it("returns true on exact match", () => {
    expect(pathOverlaps("src/foo.ts", ["src/foo.ts"])).toBe(true);
  });

  it("returns true when written file is under cached directory", () => {
    // Written file under a grep/list_files cached dir
    expect(pathOverlaps("src/utils/helper.ts", ["src/utils"])).toBe(true);
  });

  it("returns true when cached path is under written path", () => {
    expect(pathOverlaps("src", ["src/utils/helper.ts"])).toBe(true);
  });

  it("returns false when paths are unrelated", () => {
    expect(pathOverlaps("src/foo.ts", ["lib/bar.ts"])).toBe(false);
  });

  it("returns false on empty cachedPaths", () => {
    expect(pathOverlaps("src/foo.ts", [])).toBe(false);
  });

  it("returns true when one of multiple cached paths overlaps", () => {
    expect(pathOverlaps("src/foo.ts", ["lib/bar.ts", "src/foo.ts"])).toBe(true);
  });

  it("does not match unrelated paths with shared prefix", () => {
    // "src/foo" is not under "src/foobar"
    expect(pathOverlaps("src/foobar/baz.ts", ["src/foo"])).toBe(false);
  });
});

// ─── ToolCache.makeKey ────────────────────────────────────────────────────────

describe("ToolCache.makeKey", () => {
  it("returns same key for identical inputs", () => {
    const a = ToolCache.makeKey("read_file", { path: "src/foo.ts" });
    const b = ToolCache.makeKey("read_file", { path: "src/foo.ts" });
    expect(a).toBe(b);
  });

  it("returns different keys for different tools", () => {
    const a = ToolCache.makeKey("read_file", { path: "src/foo.ts" });
    const b = ToolCache.makeKey("grep", { path: "src/foo.ts" });
    expect(a).not.toBe(b);
  });

  it("returns different keys for different inputs", () => {
    const a = ToolCache.makeKey("read_file", { path: "src/foo.ts" });
    const b = ToolCache.makeKey("read_file", { path: "src/bar.ts" });
    expect(a).not.toBe(b);
  });

  it("is order-independent for input keys", () => {
    const a = ToolCache.makeKey("grep", { path: "src", pattern: "hello" });
    const b = ToolCache.makeKey("grep", { pattern: "hello", path: "src" });
    expect(a).toBe(b);
  });

  it("returns a 16-char hex string", () => {
    const key = ToolCache.makeKey("read_file", { path: "src/foo.ts" });
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ─── CACHEABLE_TOOLS ─────────────────────────────────────────────────────────

describe("CACHEABLE_TOOLS", () => {
  it("contains read_file, grep, list_files", () => {
    expect(CACHEABLE_TOOLS.has("read_file")).toBe(true);
    expect(CACHEABLE_TOOLS.has("grep")).toBe(true);
    expect(CACHEABLE_TOOLS.has("list_files")).toBe(true);
  });

  it("does not contain write_file or bash", () => {
    expect(CACHEABLE_TOOLS.has("write_file")).toBe(false);
    expect(CACHEABLE_TOOLS.has("bash")).toBe(false);
  });
});

// ─── ToolCache class ─────────────────────────────────────────────────────────

describe("ToolCache", () => {
  let cache: ToolCache;

  beforeEach(() => {
    cache = new ToolCache();
  });

  describe("isCacheable", () => {
    it("returns true for read-only tools", () => {
      expect(cache.isCacheable("read_file")).toBe(true);
      expect(cache.isCacheable("grep")).toBe(true);
      expect(cache.isCacheable("list_files")).toBe(true);
    });

    it("returns false for write tools", () => {
      expect(cache.isCacheable("write_file")).toBe(false);
      expect(cache.isCacheable("bash")).toBe(false);
    });
  });

  describe("get / set", () => {
    it("returns undefined on cache miss", () => {
      expect(cache.get("read_file", { path: "src/foo.ts" })).toBeUndefined();
    });

    it("returns cached result on cache hit", () => {
      cache.set("read_file", { path: "src/foo.ts" }, "file contents");
      expect(cache.get("read_file", { path: "src/foo.ts" })).toBe("file contents");
    });

    it("does not cache non-cacheable tools", () => {
      cache.set("write_file", { path: "src/foo.ts" }, "something");
      expect(cache.get("write_file", { path: "src/foo.ts" })).toBeUndefined();
    });

    it("handles multiple distinct entries", () => {
      cache.set("read_file", { path: "src/a.ts" }, "a");
      cache.set("read_file", { path: "src/b.ts" }, "b");
      expect(cache.get("read_file", { path: "src/a.ts" })).toBe("a");
      expect(cache.get("read_file", { path: "src/b.ts" })).toBe("b");
    });
  });

  describe("stats", () => {
    it("starts with zero stats", () => {
      const s = cache.stats();
      expect(s.hits).toBe(0);
      expect(s.misses).toBe(0);
      expect(s.entries).toBe(0);
      expect(s.invalidations).toBe(0);
      expect(s.invalidatedEntries).toBe(0);
    });

    it("counts hits and misses correctly", () => {
      cache.set("read_file", { path: "a.ts" }, "content");
      cache.get("read_file", { path: "a.ts" }); // hit
      cache.get("read_file", { path: "b.ts" }); // miss
      cache.get("grep", { path: "src" }); // miss

      const s = cache.stats();
      expect(s.hits).toBe(1);
      expect(s.misses).toBe(2);
    });

    it("tracks per-tool stats", () => {
      cache.set("read_file", { path: "a.ts" }, "content");
      cache.get("read_file", { path: "a.ts" }); // hit
      cache.get("grep", { path: "src" }); // miss

      const s = cache.stats();
      expect(s.toolStats["read_file"].hits).toBe(1);
      expect(s.toolStats["read_file"].misses).toBe(0);
      expect(s.toolStats["grep"].hits).toBe(0);
      expect(s.toolStats["grep"].misses).toBe(1);
    });

    it("reflects entry count", () => {
      cache.set("read_file", { path: "a.ts" }, "a");
      cache.set("grep", { path: "src", pattern: "foo" }, "results");
      expect(cache.stats().entries).toBe(2);
    });
  });

  describe("invalidateForPath", () => {
    it("removes only overlapping entries", () => {
      cache.set("read_file", { path: "src/foo.ts" }, "foo");
      cache.set("read_file", { path: "src/bar.ts" }, "bar");

      const removed = cache.invalidateForPath("src/foo.ts");
      expect(removed).toBe(1);
      expect(cache.get("read_file", { path: "src/foo.ts" })).toBeUndefined();
      expect(cache.get("read_file", { path: "src/bar.ts" })).toBe("bar");
    });

    it("removes grep entries when a file under their dir is written", () => {
      cache.set("grep", { path: "src", pattern: "hello" }, "matches");
      cache.set("read_file", { path: "lib/other.ts" }, "other");

      const removed = cache.invalidateForPath("src/newfile.ts");
      expect(removed).toBe(1);
      expect(cache.get("grep", { path: "src", pattern: "hello" })).toBeUndefined();
      expect(cache.get("read_file", { path: "lib/other.ts" })).toBe("other");
    });

    it("increments invalidation count and invalidatedEntries in stats", () => {
      cache.set("read_file", { path: "src/foo.ts" }, "foo");
      cache.invalidateForPath("src/foo.ts");

      const s = cache.stats();
      expect(s.invalidations).toBe(1);
      expect(s.invalidatedEntries).toBe(1);
    });

    it("returns 0 when no entries overlap", () => {
      cache.set("read_file", { path: "lib/bar.ts" }, "bar");
      const removed = cache.invalidateForPath("src/unrelated.ts");
      expect(removed).toBe(0);
    });
  });

  describe("invalidate (full clear)", () => {
    it("clears all entries", () => {
      cache.set("read_file", { path: "a.ts" }, "a");
      cache.set("grep", { path: "src", pattern: "x" }, "x");
      cache.invalidate();
      expect(cache.stats().entries).toBe(0);
    });

    it("increments invalidation count", () => {
      cache.set("read_file", { path: "a.ts" }, "a");
      cache.invalidate();
      expect(cache.stats().invalidations).toBe(1);
      expect(cache.stats().invalidatedEntries).toBe(1);
    });
  });

  describe("clear", () => {
    it("resets all stats and entries", () => {
      cache.set("read_file", { path: "a.ts" }, "a");
      cache.get("read_file", { path: "a.ts" }); // hit
      cache.get("grep", { path: "src" }); // miss
      cache.clear();

      const s = cache.stats();
      expect(s.hits).toBe(0);
      expect(s.misses).toBe(0);
      expect(s.entries).toBe(0);
      expect(s.invalidations).toBe(0);
    });
  });

  describe("serialize / deserialize", () => {
    let tmpDir: string;
    let cacheFile: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(path.join(tmpdir(), "tool-cache-test-"));
      cacheFile = path.join(tmpDir, "cache.json");
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("round-trips a cache entry via serialize/deserialize", () => {
      // Write a real file so mtime check passes
      const testFile = path.join(tmpDir, "foo.ts");
      writeFileSync(testFile, "hello");

      cache.set("read_file", { path: testFile }, "hello");
      cache.serialize(cacheFile);

      const cache2 = new ToolCache();
      const result = cache2.deserialize(cacheFile);

      expect(result.total).toBe(1);
      expect(result.restored).toBe(1);
      expect(result.stale).toBe(0);
      expect(cache2.get("read_file", { path: testFile })).toBe("hello");
    });

    it("marks entry as stale when file has changed", () => {
      const testFile = path.join(tmpDir, "foo.ts");
      writeFileSync(testFile, "original");

      cache.set("read_file", { path: testFile }, "original");
      cache.serialize(cacheFile);

      // Write new content — changes mtime
      writeFileSync(testFile, "modified");

      const cache2 = new ToolCache();
      const result = cache2.deserialize(cacheFile);

      expect(result.stale).toBe(1);
      expect(result.restored).toBe(0);
      expect(cache2.get("read_file", { path: testFile })).toBeUndefined();
    });

    it("returns zeros when cache file does not exist", () => {
      const result = cache.deserialize("/nonexistent/path/cache.json");
      expect(result).toEqual({ restored: 0, stale: 0, total: 0 });
    });

    it("returns zeros when cache file contains invalid JSON", () => {
      writeFileSync(cacheFile, "not valid json {{");
      const result = cache.deserialize(cacheFile);
      expect(result).toEqual({ restored: 0, stale: 0, total: 0 });
    });

    it("returns count of serialized entries", () => {
      const f1 = path.join(tmpDir, "a.ts");
      const f2 = path.join(tmpDir, "b.ts");
      writeFileSync(f1, "a");
      writeFileSync(f2, "b");

      cache.set("read_file", { path: f1 }, "a");
      cache.set("read_file", { path: f2 }, "b");

      const count = cache.serialize(cacheFile);
      expect(count).toBe(2);
    });
  });
});
