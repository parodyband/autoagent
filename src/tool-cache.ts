/**
 * Tool Result Cache — caches idempotent tool results within a single iteration.
 *
 * Only caches read-only tools (read_file, grep, list_files) to avoid stale data issues.
 * Cache lifetime is one iteration — create a new instance per iteration.
 *
 * Smart invalidation: write_file only invalidates entries whose path overlaps
 * the written file, rather than clearing the entire cache.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  invalidations: number;
  invalidatedEntries: number;
  /** Tool-level breakdown */
  toolStats: Record<string, { hits: number; misses: number }>;
}

export interface CacheEntry {
  result: string;
  cachedAt: number; // Date.now()
  /** File path(s) this entry depends on — used for smart invalidation */
  paths: string[];
}

// ─── Constants ──────────────────────────────────────────────

/** Tools whose results are safe to cache (read-only, idempotent) */
export const CACHEABLE_TOOLS = new Set(["read_file", "grep", "list_files"]);

// ─── Helpers ────────────────────────────────────────────────

/**
 * Extract the file path(s) that a cached tool result depends on.
 * - read_file: depends on the exact file path
 * - grep: depends on the search directory (any file within could affect results)
 * - list_files: depends on the listed directory
 */
export function extractPaths(toolName: string, input: Record<string, unknown>): string[] {
  const p = input.path as string | undefined;
  if (!p) return [];

  switch (toolName) {
    case "read_file":
      // Depends on the exact file
      return [path.normalize(p)];
    case "grep":
    case "list_files":
      // Depends on the directory — any file change under it could affect results
      return [path.normalize(p)];
    default:
      return [];
  }
}

/**
 * Check if a written file path could affect a cached entry's paths.
 * - For read_file: exact match
 * - For grep/list_files: the written file is under the cached search directory
 */
export function pathOverlaps(writtenFile: string, cachedPaths: string[]): boolean {
  const normalizedWrite = path.normalize(writtenFile);
  for (const cachedPath of cachedPaths) {
    // Exact match (read_file case)
    if (normalizedWrite === cachedPath) return true;
    // Written file is within cached directory (grep/list_files case)
    if (normalizedWrite.startsWith(cachedPath + path.sep)) return true;
    // Cached path is within or equal to written file's directory
    if (cachedPath.startsWith(normalizedWrite + path.sep)) return true;
  }
  return false;
}

// ─── Cache ──────────────────────────────────────────────────

export class ToolCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private invalidationCount = 0;
  private invalidatedEntryCount = 0;
  private toolHits: Record<string, number> = {};
  private toolMisses: Record<string, number> = {};

  /** Generate a deterministic cache key from tool name + input */
  static makeKey(toolName: string, input: Record<string, unknown>): string {
    // Sort input keys for deterministic serialization
    const sortedInput: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      sortedInput[key] = input[key];
    }
    const normalized = toolName + ":" + JSON.stringify(sortedInput);
    return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  /** Check if a tool's results are cacheable */
  isCacheable(toolName: string): boolean {
    return CACHEABLE_TOOLS.has(toolName);
  }

  /** Get a cached result, or undefined if not cached */
  get(toolName: string, input: Record<string, unknown>): string | undefined {
    if (!this.isCacheable(toolName)) return undefined;

    const key = ToolCache.makeKey(toolName, input);
    const entry = this.cache.get(key);

    if (entry) {
      this.hits++;
      this.toolHits[toolName] = (this.toolHits[toolName] || 0) + 1;
      return entry.result;
    }

    this.misses++;
    this.toolMisses[toolName] = (this.toolMisses[toolName] || 0) + 1;
    return undefined;
  }

  /** Store a result in the cache */
  set(toolName: string, input: Record<string, unknown>, result: string): void {
    if (!this.isCacheable(toolName)) return;

    const key = ToolCache.makeKey(toolName, input);
    const paths = extractPaths(toolName, input);
    this.cache.set(key, { result, cachedAt: Date.now(), paths });
  }

  /**
   * Invalidate cache entries affected by a file write.
   * Only removes entries whose tracked paths overlap with the written file.
   * Falls back to clearing everything if no path is provided.
   */
  invalidateForPath(writtenPath: string): number {
    this.invalidationCount++;
    const normalizedPath = path.normalize(writtenPath);
    let removed = 0;

    for (const [key, entry] of this.cache) {
      // If entry has no tracked paths, conservatively remove it
      if (entry.paths.length === 0 || pathOverlaps(normalizedPath, entry.paths)) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.invalidatedEntryCount += removed;
    return removed;
  }

  /** Invalidate all cache entries (full clear) */
  invalidate(): void {
    this.invalidationCount++;
    this.invalidatedEntryCount += this.cache.size;
    this.cache.clear();
  }

  /** Get cache statistics */
  stats(): CacheStats {
    const allTools = new Set([...Object.keys(this.toolHits), ...Object.keys(this.toolMisses)]);
    const toolStats: Record<string, { hits: number; misses: number }> = {};
    for (const tool of allTools) {
      toolStats[tool] = {
        hits: this.toolHits[tool] || 0,
        misses: this.toolMisses[tool] || 0,
      };
    }

    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size,
      invalidations: this.invalidationCount,
      invalidatedEntries: this.invalidatedEntryCount,
      toolStats,
    };
  }

  /** Reset all stats and entries */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.invalidationCount = 0;
    this.invalidatedEntryCount = 0;
    this.toolHits = {};
    this.toolMisses = {};
  }

  // ─── Persistence ────────────────────────────────────────

  /**
   * Serializable representation of a cache entry, including
   * the file mtime at cache time for staleness detection.
   */
  private static getFileMtime(filePath: string): number | null {
    try {
      return statSync(filePath).mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Serialize hot cache entries to a JSON file.
   * Stores the file mtime alongside each entry so deserialization
   * can detect stale entries.
   */
  serialize(filePath: string, rootDir?: string): number {
    const entries: Array<{
      key: string;
      result: string;
      paths: string[];
      mtimes: Record<string, number>;
    }> = [];

    for (const [key, entry] of this.cache) {
      const mtimes: Record<string, number> = {};
      for (const p of entry.paths) {
        const fullPath = rootDir ? path.resolve(rootDir, p) : p;
        const mtime = ToolCache.getFileMtime(fullPath);
        if (mtime !== null) {
          mtimes[p] = mtime;
        }
      }
      entries.push({ key, result: entry.result, paths: entry.paths, mtimes });
    }

    writeFileSync(filePath, JSON.stringify(entries));
    return entries.length;
  }

  /**
   * Deserialize cache entries from a JSON file.
   * Only restores entries whose tracked files haven't changed (mtime check).
   * Returns { restored, stale, total } counts.
   */
  deserialize(
    filePath: string,
    rootDir?: string
  ): { restored: number; stale: number; total: number } {
    if (!existsSync(filePath)) {
      return { restored: 0, stale: 0, total: 0 };
    }

    let entries: Array<{
      key: string;
      result: string;
      paths: string[];
      mtimes: Record<string, number>;
    }>;
    try {
      entries = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      return { restored: 0, stale: 0, total: 0 };
    }

    let restored = 0;
    let stale = 0;

    for (const entry of entries) {
      let isStale = false;

      // Check each tracked path's mtime against the stored mtime
      for (const [p, storedMtime] of Object.entries(entry.mtimes)) {
        const fullPath = rootDir ? path.resolve(rootDir, p) : p;
        const currentMtime = ToolCache.getFileMtime(fullPath);
        if (currentMtime === null || currentMtime !== storedMtime) {
          isStale = true;
          break;
        }
      }

      if (isStale) {
        stale++;
      } else {
        this.cache.set(entry.key, {
          result: entry.result,
          cachedAt: Date.now(),
          paths: entry.paths,
        });
        restored++;
      }
    }

    return { restored, stale, total: entries.length };
  }
}
