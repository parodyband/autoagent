/**
 * Tool Result Cache — caches idempotent tool results within a single iteration.
 *
 * Only caches read-only tools (read_file, grep) to avoid stale data issues.
 * Cache lifetime is one iteration — create a new instance per iteration.
 */

import { createHash } from "crypto";

// ─── Types ──────────────────────────────────────────────────

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  /** Tool-level breakdown */
  toolStats: Record<string, { hits: number; misses: number }>;
}

export interface CacheEntry {
  result: string;
  cachedAt: number; // Date.now()
}

// ─── Constants ──────────────────────────────────────────────

/** Tools whose results are safe to cache (read-only, idempotent) */
export const CACHEABLE_TOOLS = new Set(["read_file", "grep", "list_files"]);

// ─── Cache ──────────────────────────────────────────────────

export class ToolCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
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
    this.cache.set(key, { result, cachedAt: Date.now() });
  }

  /** Invalidate cache entries for a specific tool (e.g., after write_file) */
  invalidate(toolName?: string): void {
    if (!toolName) {
      this.cache.clear();
      return;
    }
    // For targeted invalidation, we'd need to track which keys belong to which tool.
    // For now, clear everything — writes are rare relative to reads.
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
      toolStats,
    };
  }

  /** Reset all stats and entries */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.toolHits = {};
    this.toolMisses = {};
  }
}
