import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FileCache } from "../file-cache.js";

let tmpDir: string;
let cache: FileCache;

function writeTmp(name: string, content: string): string {
  const p = join(tmpDir, name);
  writeFileSync(p, content, "utf-8");
  return p;
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `file-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  cache = new FileCache();
});

afterEach(() => {
  cache.clear();
});

describe("FileCache", () => {
  it("cache hit returns content when file unchanged", () => {
    const p = writeTmp("a.txt", "hello world");
    cache.put(p, "hello world");
    const result = cache.get(p);
    expect(result).not.toBeNull();
    expect(result!.hit).toBe(true);
    expect(result!.content).toBe("hello world");
  });

  it("cache miss when file modified (mtime changed)", async () => {
    const p = writeTmp("b.txt", "original");
    cache.put(p, "original");
    // Wait a tick then overwrite to change mtime
    await new Promise((r) => setTimeout(r, 10));
    writeFileSync(p, "modified", "utf-8");
    const result = cache.get(p);
    expect(result).toBeNull();
  });

  it("returns null for files not in cache", () => {
    const p = writeTmp("c.txt", "data");
    expect(cache.get(p)).toBeNull();
  });

  it("invalidate() removes entry", () => {
    const p = writeTmp("d.txt", "data");
    cache.put(p, "data");
    cache.invalidate(p);
    expect(cache.get(p)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("clear() flushes all entries", () => {
    const p1 = writeTmp("e1.txt", "aaa");
    const p2 = writeTmp("e2.txt", "bbb");
    cache.put(p1, "aaa");
    cache.put(p2, "bbb");
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });

  it("LRU eviction when maxEntries exceeded", () => {
    const smallCache = new FileCache(3);
    const paths = ["f1.txt", "f2.txt", "f3.txt", "f4.txt"].map((n) => {
      const p = writeTmp(n, n);
      return p;
    });
    smallCache.put(paths[0], "f1.txt");
    smallCache.put(paths[1], "f2.txt");
    smallCache.put(paths[2], "f3.txt");
    // Promote f1 by reading it
    smallCache.get(paths[0]);
    // Add f4 — should evict f2 (LRU after f1 was promoted)
    smallCache.put(paths[3], "f4.txt");
    expect(smallCache.size).toBe(3);
    // f2 should be evicted
    expect(smallCache.get(paths[1])).toBeNull();
    // f1 should still be present
    expect(smallCache.get(paths[0])).not.toBeNull();
  });

  it("maxBytes limit enforced", () => {
    const tinyCache = new FileCache(100, 100); // 100 bytes max
    const p1 = writeTmp("g1.txt", "A".repeat(60));
    const p2 = writeTmp("g2.txt", "B".repeat(60));
    tinyCache.put(p1, "A".repeat(60));
    tinyCache.put(p2, "B".repeat(60)); // Should evict p1 to make room
    expect(tinyCache.size).toBe(1);
    expect(tinyCache.bytes).toBeLessThanOrEqual(100);
    expect(tinyCache.get(p1)).toBeNull(); // evicted
    expect(tinyCache.get(p2)).not.toBeNull();
  });

  it("does not cache files larger than maxBytes", () => {
    const tinyCache = new FileCache(100, 50);
    const p = writeTmp("huge.txt", "X".repeat(100));
    tinyCache.put(p, "X".repeat(100));
    expect(tinyCache.size).toBe(0);
  });
});
