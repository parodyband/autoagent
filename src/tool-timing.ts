/**
 * Tool Timing Tracker — records per-tool execution durations.
 *
 * Tracks min/max/avg/total/count for each tool across an iteration.
 * Create a new instance per iteration.
 */

// ─── Types ──────────────────────────────────────────────────

export interface ToolTimingEntry {
  calls: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
}

export interface TimingStats {
  /** Per-tool timing breakdown */
  tools: Record<string, ToolTimingEntry>;
  /** Total calls across all tools */
  totalCalls: number;
  /** Total time across all tools */
  totalMs: number;
}

// ─── Tracker ────────────────────────────────────────────────

export class ToolTimingTracker {
  private data: Map<string, { calls: number; totalMs: number; minMs: number; maxMs: number }> = new Map();

  /** Record a tool execution duration */
  record(toolName: string, durationMs: number): void {
    const existing = this.data.get(toolName);
    if (existing) {
      existing.calls++;
      existing.totalMs += durationMs;
      existing.minMs = Math.min(existing.minMs, durationMs);
      existing.maxMs = Math.max(existing.maxMs, durationMs);
    } else {
      this.data.set(toolName, {
        calls: 1,
        totalMs: durationMs,
        minMs: durationMs,
        maxMs: durationMs,
      });
    }
  }

  /** Get timing stats for a specific tool */
  getToolStats(toolName: string): ToolTimingEntry | undefined {
    const d = this.data.get(toolName);
    if (!d) return undefined;
    return {
      calls: d.calls,
      totalMs: d.totalMs,
      minMs: d.minMs,
      maxMs: d.maxMs,
      avgMs: d.calls > 0 ? Math.round(d.totalMs / d.calls) : 0,
    };
  }

  /** Get full timing stats */
  stats(): TimingStats {
    const tools: Record<string, ToolTimingEntry> = {};
    let totalCalls = 0;
    let totalMs = 0;

    for (const [name, d] of this.data) {
      tools[name] = {
        calls: d.calls,
        totalMs: d.totalMs,
        minMs: d.minMs,
        maxMs: d.maxMs,
        avgMs: d.calls > 0 ? Math.round(d.totalMs / d.calls) : 0,
      };
      totalCalls += d.calls;
      totalMs += d.totalMs;
    }

    return { tools, totalCalls, totalMs };
  }

  /** Get all tracked tool names */
  getTrackedTools(): string[] {
    return Array.from(this.data.keys());
  }

  /** Reset all timing data */
  clear(): void {
    this.data.clear();
  }
}
