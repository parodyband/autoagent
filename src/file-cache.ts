/**
 * LRU file content cache — avoids re-reading unchanged files.
 * Mirrors Claude Code's approach: up to 100 files / 25 MB cached by mtime.
 */

import { statSync } from "fs";

interface CacheEntry {
  filePath: string;
  content: string;
  mtime: number; // ms since epoch
  size: number;  // byte length of content
}

export class FileCache {
  private readonly maxEntries: number;
  private readonly maxBytes: number;

  /** LRU order: index 0 = most recently used, last = least recently used. */
  private order: string[] = [];
  private store = new Map<string, CacheEntry>();
  private totalBytes = 0;

  constructor(
    maxEntries: number = 100,
    maxBytes: number = 25 * 1024 * 1024,
  ) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
  }

  /**
   * Retrieve a cached file.
   * Returns `{ content, hit: true }` if cache is valid, or `null` on miss/stale.
   */
  get(filePath: string): { content: string; hit: boolean } | null {
    const entry = this.store.get(filePath);
    if (!entry) return null;

    // Validate mtime
    let mtime: number;
    try {
      mtime = statSync(filePath).mtimeMs;
    } catch {
      // File gone — evict
      this._evictEntry(filePath);
      return null;
    }

    if (mtime !== entry.mtime) {
      // Stale — evict
      this._evictEntry(filePath);
      return null;
    }

    // Cache hit — promote to front of LRU
    this._promote(filePath);
    return { content: entry.content, hit: true };
  }

  /**
   * Store file content in cache, evicting LRU entries as needed.
   */
  put(filePath: string, content: string): void {
    let mtime: number;
    try {
      mtime = statSync(filePath).mtimeMs;
    } catch {
      return; // Can't stat the file — skip caching
    }

    const size = Buffer.byteLength(content, "utf-8");

    // If this single file exceeds maxBytes, don't cache it
    if (size > this.maxBytes) return;

    // If entry already exists, remove it first
    if (this.store.has(filePath)) {
      this._evictEntry(filePath);
    }

    // Evict LRU entries until we have room
    while (
      this.order.length >= this.maxEntries ||
      this.totalBytes + size > this.maxBytes
    ) {
      const lru = this.order[this.order.length - 1];
      if (!lru) break;
      this._evictEntry(lru);
    }

    this.store.set(filePath, { filePath, content, mtime, size });
    this.order.unshift(filePath);
    this.totalBytes += size;
  }

  /** Remove a single entry from the cache. */
  invalidate(filePath: string): void {
    this._evictEntry(filePath);
  }

  /** Flush all cached entries. */
  clear(): void {
    this.store.clear();
    this.order = [];
    this.totalBytes = 0;
  }

  /** Current number of cached entries (for tests/metrics). */
  get size(): number {
    return this.store.size;
  }

  /** Current total bytes stored (for tests/metrics). */
  get bytes(): number {
    return this.totalBytes;
  }

  private _evictEntry(filePath: string): void {
    const entry = this.store.get(filePath);
    if (!entry) return;
    this.store.delete(filePath);
    this.totalBytes -= entry.size;
    const idx = this.order.indexOf(filePath);
    if (idx !== -1) this.order.splice(idx, 1);
  }

  private _promote(filePath: string): void {
    const idx = this.order.indexOf(filePath);
    if (idx > 0) {
      this.order.splice(idx, 1);
      this.order.unshift(filePath);
    }
  }
}

/** Singleton cache shared across the process. */
export const globalFileCache = new FileCache();

/**
 * Tracks the mtime (ms) at the time each file was last read by the agent.
 * Used to detect external modifications before write_file executes.
 */
export class MtimeTracker {
  private readonly mtimes = new Map<string, number>();

  /** Record the mtime for a file path (absolute). */
  record(filePath: string, mtimeMs: number): void {
    this.mtimes.set(filePath, mtimeMs);
  }

  /**
   * Check if a file has been modified since it was last read.
   * Returns true if modified, false if unchanged or never read.
   */
  isStale(filePath: string, currentMtimeMs: number): boolean {
    const recorded = this.mtimes.get(filePath);
    if (recorded === undefined) return false; // never read — not stale
    return currentMtimeMs > recorded;
  }

  /** Remove a tracked entry (e.g. after a write). */
  delete(filePath: string): void {
    this.mtimes.delete(filePath);
  }

  /** Clear all tracked mtimes. */
  clear(): void {
    this.mtimes.clear();
  }
}

/** Singleton mtime tracker shared across the process. */
export const globalMtimeTracker = new MtimeTracker();
