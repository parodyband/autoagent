/**
 * Reflection Aggregator
 *
 * Batches ReflectionCheckpoints across a session window, detects recurring
 * failure patterns with recency-weighted frequency analysis, and generates
 * a ready-to-inject system-prompt addendum so future tasks can avoid
 * mistakes the agent has already made.
 *
 * Design:
 *   detectPatterns(checkpoints) → FailurePattern[]   — pure, testable
 *   generateGuidancePrompt(patterns, windowSize)     — markdown section
 *   aggregate(checkpoints)      → AggregateReport    — full report
 *   savePatternCache / loadPatternCache              — cross-session persistence
 *
 * No dependency on orchestrator.ts — imports only reflection.js and
 * project-memory.js to avoid circular modules.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { ReflectionCheckpoint, ToolCallRecord } from "./reflection.js";
import { findProjectRoot } from "./project-memory.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type FailureCategory =
  | "tool_error"         // tool returned isError = true
  | "auto_retry"         // tool triggered wasRetried = true
  | "verification_fail"  // verificationPassed === false
  | "context_overflow"   // compactionTriggered === true
  | "tsc_failure";       // tscClean === false

export interface FailurePattern {
  /** Stable ID, e.g. "tool_error:bash:timeout" — used for deduplication. */
  id: string;
  category: FailureCategory;
  /** Which tool triggered the pattern, if applicable. */
  toolName?: string;
  /** Human-readable description, e.g. "bash: command timeout". */
  description: string;
  /** Number of distinct checkpoints in the window that contained this pattern. */
  occurrences: number;
  /** ISO 8601 timestamp of the most recent occurrence. */
  lastSeen: string;
  /** Up to 3 raw result snippets for context. */
  examples: string[];
  /** One-line actionable advice to inject into the system prompt. */
  suggestedFix: string;
  /**
   * Recency-weighted score: occurrences × recency factor.
   * Used to rank patterns — recent patterns outrank stale ones.
   */
  weight: number;
}

export interface AggregateReport {
  /** Number of checkpoints in the analysis window. */
  windowSize: number;
  totalTasks: number;
  /** 0–1 fraction of tasks that reported success. */
  successRate: number;
  /** Top patterns sorted by weight descending (max 10). */
  topPatterns: FailurePattern[];
  /** Per-tool error rate (0–1): errors ÷ total calls for that tool. */
  toolErrorRates: Record<string, number>;
  /** Session-wide retry rate: retries ÷ total tool calls. */
  avgRetryRate: number;
  /** Fraction of tasks that triggered context compaction. */
  compactionRate: number;
  /**
   * Ready-to-inject markdown section for the system prompt.
   * Empty string when there are no significant patterns to report.
   */
  guidancePrompt: string;
  generatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PATTERNS_FILE = ".autoagent/patterns.json";
/** A pattern must appear in at least this many checkpoints to be surfaced. */
const MIN_OCCURRENCES = 2;
/** Maximum patterns to include in the guidance prompt. */
const GUIDANCE_MAX_PATTERNS = 5;

// ─── Error category → fix mapping ────────────────────────────────────────────

type ErrorKey =
  | "file_not_found"
  | "command_not_found"
  | "timeout"
  | "permission_denied"
  | "module_not_found"
  | "json_syntax"
  | "out_of_memory"
  | "generic_error";

const ERROR_HINTS: Record<ErrorKey, { label: string; fix: string }> = {
  file_not_found: {
    label: "file not found (ENOENT)",
    fix: "Verify the path with list_files before reading; check for .js vs .ts extension mismatches",
  },
  command_not_found: {
    label: "command not found",
    fix: "Prefix with `npx` for local bin tools; confirm installation with `npm list` first",
  },
  timeout: {
    label: "command timeout",
    fix: "Split long commands; add `| head -50` to cap output; avoid unbounded `find` or `grep -r` on large trees",
  },
  permission_denied: {
    label: "permission denied",
    fix: "Check ownership with `ls -la`; do not run as root unless necessary",
  },
  module_not_found: {
    label: "module not found",
    fix: "Run `npm install <pkg>` before importing; verify the import path uses the correct extension (.js)",
  },
  json_syntax: {
    label: "JSON syntax error",
    fix: "Check for trailing commas, unquoted keys, or mismatched brackets before parsing",
  },
  out_of_memory: {
    label: "out of memory",
    fix: "Increase Node heap with NODE_OPTIONS=--max-old-space-size=4096; reduce input size",
  },
  generic_error: {
    label: "tool error",
    fix: "Read the full error message carefully; validate tool inputs before calling",
  },
};

function classifyError(snippet: string): ErrorKey {
  const s = snippet.toLowerCase();
  if (/enoent|no such file|file not found|cannot find|does not exist/.test(s)) return "file_not_found";
  if (/command not found|not recognized|no such command/.test(s))              return "command_not_found";
  if (/timed?\s*out|etimedout/.test(s))                                        return "timeout";
  if (/permission denied|eacces/.test(s))                                      return "permission_denied";
  if (/cannot find module|module not found|err_module_not_found|failed to resolve import/.test(s)) return "module_not_found";
  if (/unexpected token|json parse|syntaxerror.*json|json at position/.test(s)) return "json_syntax";
  if (/out of memory|enomem|heap out of memory|javascript heap|allocation failed/.test(s)) return "out_of_memory";
  return "generic_error";
}

// ─── Core: pattern detection ──────────────────────────────────────────────────

/**
 * Detect recurring failure patterns across a window of checkpoints.
 *
 * Categories detected:
 *   tool_error       — isError=true tool calls, grouped by (tool, error class)
 *   auto_retry       — wasRetried=true calls, grouped by tool
 *   verification_fail — verificationPassed === false
 *   context_overflow  — compactionTriggered === true
 *   tsc_failure       — tscClean === false
 *
 * Recency weighting: newest third of window scores 1.0×, middle 0.7×, oldest 0.4×.
 * Only patterns with occurrences ≥ MIN_OCCURRENCES are returned.
 *
 * @returns Patterns sorted by weight descending.
 */
export function detectPatterns(checkpoints: ReflectionCheckpoint[]): FailurePattern[] {
  if (checkpoints.length === 0) return [];

  const n = checkpoints.length;

  // Recency factor: newest checkpoints outweigh old ones
  function recency(idx: number): number {
    const pos = idx / n; // 0 = oldest, (n-1)/n ≈ 1 = newest
    if (pos >= 0.67) return 1.0;
    if (pos >= 0.33) return 0.7;
    return 0.4;
  }

  // Accumulators: patternId → { weight, occurrences, lastSeen, examples }
  const acc = new Map<string, {
    weight:      number;
    occurrences: number;
    lastSeen:    string;
    examples:    string[];
    category:    FailureCategory;
    toolName?:   string;
    errorKey?:   ErrorKey;
  }>();

  function bump(
    id:        string,
    idx:       number,
    category:  FailureCategory,
    timestamp: string,
    snippet?:  string,
    toolName?: string,
    errorKey?: ErrorKey,
  ): void {
    const existing = acc.get(id);
    if (!existing) {
      acc.set(id, {
        weight: recency(idx),
        occurrences: 1,
        lastSeen: timestamp,
        examples: snippet ? [snippet] : [],
        category,
        toolName,
        errorKey,
      });
    } else {
      existing.weight      += recency(idx);
      existing.occurrences += 1;
      if (timestamp > existing.lastSeen) existing.lastSeen = timestamp;
      if (snippet && existing.examples.length < 3) existing.examples.push(snippet);
    }
  }

  for (let i = 0; i < n; i++) {
    const cp = checkpoints[i];
    const cpTs = cp.startedAt;

    // ── Per-checkpoint task-level signals ────────────────────────────────────
    if (cp.verificationPassed === false) {
      bump("verification_fail:post_edit", i, "verification_fail", cpTs);
    }
    if (cp.compactionTriggered) {
      bump("context_overflow:compaction", i, "context_overflow", cpTs);
    }
    if (cp.tscClean === false) {
      bump("tsc_failure:typescript", i, "tsc_failure", cpTs);
    }

    // ── Per-tool signals (deduplicated within a checkpoint) ───────────────────
    // Track which (tool, errorKey) and (tool, retry) combos appeared in this cp
    const seenToolError = new Set<string>();
    const seenToolRetry = new Set<string>();

    for (const tc of cp.toolCalls) {
      if (tc.isError) {
        const ek = classifyError(tc.resultSnippet);
        const id = `tool_error:${tc.name}:${ek}`;
        if (!seenToolError.has(id)) {
          seenToolError.add(id);
          bump(id, i, "tool_error", tc.timestamp, tc.resultSnippet.slice(0, 120), tc.name, ek);
        }
      }
      if (tc.wasRetried) {
        const id = `auto_retry:${tc.name}`;
        if (!seenToolRetry.has(id)) {
          seenToolRetry.add(id);
          bump(id, i, "auto_retry", tc.timestamp, undefined, tc.name);
        }
      }
    }
  }

  // ── Build FailurePattern objects, filter by MIN_OCCURRENCES ──────────────────
  const patterns: FailurePattern[] = [];

  for (const [id, a] of acc) {
    if (a.occurrences < MIN_OCCURRENCES) continue;

    let description: string;
    let suggestedFix: string;

    switch (a.category) {
      case "tool_error": {
        const hint = ERROR_HINTS[a.errorKey ?? "generic_error"];
        description  = `${a.toolName}: ${hint.label}`;
        suggestedFix = hint.fix;
        break;
      }
      case "auto_retry":
        description  = `${a.toolName}: auto-retry triggered`;
        suggestedFix = `Validate ${a.toolName} inputs before calling — check paths, parameters, and prerequisites`;
        break;
      case "verification_fail":
        description  = "post-edit verification failed";
        suggestedFix = "Run `npx tsc --noEmit 2>&1 | head -20` after each write_file; resolve errors immediately";
        break;
      case "context_overflow":
        description  = "context window pressure (compaction triggered)";
        suggestedFix = "Use `sed -n 'N,Mp'` instead of full cat; add `| head -50` to commands; avoid re-reading large files";
        break;
      case "tsc_failure":
        description  = "TypeScript compilation errors at task end";
        suggestedFix = "Check tsc output after every write_file batch; never leave TS errors unresolved before RESTART";
        break;
      default:
        description  = id;
        suggestedFix = "Review recent failure context";
    }

    patterns.push({
      id,
      category:    a.category,
      toolName:    a.toolName,
      description,
      occurrences: a.occurrences,
      lastSeen:    a.lastSeen,
      examples:    a.examples,
      suggestedFix,
      weight:      a.weight,
    });
  }

  return patterns.sort((a, b) => b.weight - a.weight);
}

// ─── Guidance prompt generation ───────────────────────────────────────────────

/**
 * Generate a concise markdown section for injection into the system prompt.
 * Returns an empty string when there are no significant patterns to report.
 *
 * @param patterns  Output of detectPatterns(), pre-sorted by weight.
 * @param windowSize Number of checkpoints analysed (for display).
 * @param max       Maximum number of patterns to include (default 5).
 */
export function generateGuidancePrompt(
  patterns:   FailurePattern[],
  windowSize  = 0,
  max         = GUIDANCE_MAX_PATTERNS,
): string {
  const top = patterns.slice(0, max);
  if (top.length === 0) return "";

  const taskLabel = windowSize > 0 ? ` (last ${windowSize} tasks)` : "";
  const lines = [
    `## Recurring Tool Patterns${taskLabel}`,
    "",
    "These failure patterns have been detected recently. Apply the following strategies proactively:",
    "",
  ];

  for (const p of top) {
    const freq = `${p.occurrences}×`;
    lines.push(`- **${p.description}** (${freq}): ${p.suggestedFix}`);
  }

  return lines.join("\n");
}

// ─── Full aggregation ─────────────────────────────────────────────────────────

/**
 * Compute a complete AggregateReport from a window of checkpoints.
 * Suitable for persisting as a cross-session pattern cache.
 */
export function aggregate(checkpoints: ReflectionCheckpoint[]): AggregateReport {
  const n = checkpoints.length;

  if (n === 0) {
    return {
      windowSize: 0, totalTasks: 0, successRate: 0,
      topPatterns: [], toolErrorRates: {},
      avgRetryRate: 0, compactionRate: 0,
      guidancePrompt: "", generatedAt: new Date().toISOString(),
    };
  }

  const topPatterns = detectPatterns(checkpoints);

  // Per-tool error rate
  const toolTotal  = new Map<string, number>();
  const toolErrors = new Map<string, number>();
  let totalCalls   = 0;
  let totalRetries = 0;

  for (const cp of checkpoints) {
    for (const tc of cp.toolCalls) {
      toolTotal.set(tc.name,  (toolTotal.get(tc.name)  ?? 0) + 1);
      if (tc.isError)    toolErrors.set(tc.name, (toolErrors.get(tc.name) ?? 0) + 1);
      if (tc.wasRetried) totalRetries++;
      totalCalls++;
    }
  }

  const toolErrorRates: Record<string, number> = {};
  for (const [name, total] of toolTotal) {
    toolErrorRates[name] = (toolErrors.get(name) ?? 0) / total;
  }

  return {
    windowSize:    n,
    totalTasks:    n,
    successRate:   checkpoints.filter(c => c.success).length / n,
    topPatterns:   topPatterns.slice(0, 10),
    toolErrorRates,
    avgRetryRate:  totalCalls > 0 ? totalRetries / totalCalls : 0,
    compactionRate: checkpoints.filter(c => c.compactionTriggered).length / n,
    guidancePrompt: generateGuidancePrompt(topPatterns, n),
    generatedAt:   new Date().toISOString(),
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/** Persist an AggregateReport to <projectRoot>/.autoagent/patterns.json. */
export function savePatternCache(workDir: string, report: AggregateReport): void {
  try {
    const dir = join(findProjectRoot(workDir), ".autoagent");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "patterns.json"), JSON.stringify(report, null, 2), "utf-8");
  } catch { /* non-fatal */ }
}

/** Load a previously-saved AggregateReport, or null if none exists / corrupt. */
export function loadPatternCache(workDir: string): AggregateReport | null {
  try {
    const fp = join(findProjectRoot(workDir), PATTERNS_FILE);
    if (!existsSync(fp)) return null;
    return JSON.parse(readFileSync(fp, "utf-8")) as AggregateReport;
  } catch {
    return null;
  }
}
