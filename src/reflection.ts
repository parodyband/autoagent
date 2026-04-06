/**
 * ReflectionCheckpoint — structured capture of task inputs, outputs,
 * tool calls, cost, duration, and success/failure at every task boundary.
 *
 * Architecture:
 *   ReflectionStore.begin()        ← called at start of send()
 *   ReflectionStore.recordToolCall() ← called after each tool execution
 *   ReflectionStore.incrementTurn() ← called after each API round-trip
 *   ReflectionStore.markCompaction() ← called when context compaction fires
 *   ReflectionStore.finalize()      ← called at end of send() with outcome
 *
 * Checkpoints are appended to .autoagent/reflections.jsonl (one JSON per line).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

// ─── Schema ─────────────────────────────────────────────────────────────────

/** A single tool invocation captured at execution time. */
export interface ToolCallRecord {
  /** Tool name (bash, read_file, write_file, grep, …) */
  name: string;
  /** Sanitized input — long string values truncated to 200 chars */
  input: Record<string, unknown>;
  /** First 300 chars of the tool's output */
  resultSnippet: string;
  /** Wall-clock time from call start to result ready (ms) */
  durationMs: number;
  /** True if the result matched isToolError() heuristics */
  isError: boolean;
  /** True if auto-retry was triggered for this call */
  wasRetried: boolean;
  /** ISO 8601 timestamp of the call start */
  timestamp: string;
}

/**
 * Full reflection captured at each task boundary (one per Orchestrator.send() call).
 * All string fields that might be large are truncated to keep the log compact.
 */
export interface ReflectionCheckpoint {
  /** Unique ID: "rc-{base36epoch}-{4hex}" */
  id: string;

  // ── Timing ──
  startedAt: string;   // ISO 8601
  finishedAt: string;  // ISO 8601
  durationMs: number;

  // ── Task inputs ──
  /** Original user message, truncated to 500 chars */
  userMessage: string;
  /** Model used for the primary agent loop */
  model: string;

  // ── Task outputs ──
  /** Final assistant text, truncated to 500 chars */
  assistantResponse: string;
  /** Paths of files written during this task */
  filesModified: string[];
  /** Git commit hash if auto-commit ran */
  commitHash?: string;

  // ── Tool call analytics ──
  toolCalls: ToolCallRecord[];
  toolCallCount: number;
  toolErrorCount: number;
  retryCount: number;

  // ── Cost & tokens ──
  tokensIn: number;
  tokensOut: number;
  costUsd: number;

  // ── Execution metadata ──
  /** Number of API round-trips (agent loop turns) */
  turnCount: number;
  /** True if context compaction (any tier) was triggered */
  compactionTriggered: boolean;

  // ── Success / failure ──
  success: boolean;
  /** Human-readable reason if success === false */
  failureReason?: string;
  /** Result of post-edit verification (undefined if no code was written) */
  verificationPassed?: boolean;
  /** True if TSC was clean at end (undefined if not checked) */
  tscClean?: boolean;
}

/** Aggregate stats across a window of stored checkpoints. */
export interface ReflectionSummary {
  total: number;
  successRate: number;        // 0–1
  avgDurationMs: number;
  avgCostUsd: number;
  avgToolCalls: number;
  avgRetries: number;
  /** Tools with the most error results, descending */
  topErrorTools: Array<{ name: string; count: number }>;
}

// ─── Internal state ─────────────────────────────────────────────────────────

interface InProgressReflection {
  id: string;
  startedAt: string;
  startMs: number;
  userMessage: string;
  model: string;
  toolCalls: ToolCallRecord[];
  compactionTriggered: boolean;
  turnCount: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const REFLECTIONS_DIR = ".autoagent";
const REFLECTIONS_FILE = "reflections.jsonl";
const MAX_IN_MEMORY = 500;

/** Truncate string values inside an input record to avoid huge log entries. */
function sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string" && v.length > 200) {
      out[k] = v.slice(0, 200) + "…";
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Captures ReflectionCheckpoints at task boundaries and persists them to disk.
 *
 * Usage:
 *   const store = new ReflectionStore(workDir);
 *   store.begin(userMessage, model);
 *   // … during execution …
 *   store.recordToolCall({ name, input, resultSnippet, durationMs, isError, wasRetried, timestamp });
 *   store.incrementTurn();
 *   store.markCompaction();
 *   // … at task end …
 *   const cp = store.finalize({ assistantResponse, filesModified, ... });
 */
export class ReflectionStore {
  private readonly filePath: string;
  private readonly dirPath: string;
  private current: InProgressReflection | null = null;
  private inMemory: ReflectionCheckpoint[] = [];

  constructor(workDir: string) {
    this.dirPath = join(workDir, REFLECTIONS_DIR);
    this.filePath = join(this.dirPath, REFLECTIONS_FILE);
    this._loadRecent();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Begin tracking a new task. Must be called before recordToolCall / finalize.
   * Returns the checkpoint ID for correlation.
   */
  begin(userMessage: string, model: string): string {
    const id = `rc-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
    this.current = {
      id,
      startedAt: new Date().toISOString(),
      startMs: Date.now(),
      userMessage: userMessage.slice(0, 500),
      model,
      toolCalls: [],
      compactionTriggered: false,
      turnCount: 0,
    };
    return id;
  }

  /** Record one tool invocation. Safe to call concurrently (push is synchronous). */
  recordToolCall(rec: ToolCallRecord): void {
    if (!this.current) return;
    this.current.toolCalls.push({
      ...rec,
      input: sanitizeInput(rec.input),
      resultSnippet: rec.resultSnippet.slice(0, 300),
    });
  }

  /** Call once per agent-loop round-trip (API call). */
  incrementTurn(): void {
    if (this.current) this.current.turnCount++;
  }

  /** Call whenever context compaction is triggered (any tier). */
  markCompaction(): void {
    if (this.current) this.current.compactionTriggered = true;
  }

  /**
   * Finalize the in-progress checkpoint with task outcome.
   * Persists to disk and returns the completed checkpoint.
   * Returns null if begin() was never called.
   */
  finalize(opts: {
    assistantResponse: string;
    filesModified: string[];
    commitHash?: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    success: boolean;
    failureReason?: string;
    verificationPassed?: boolean;
    tscClean?: boolean;
  }): ReflectionCheckpoint | null {
    if (!this.current) return null;

    const c = this.current;
    this.current = null; // clear before any async work

    const checkpoint: ReflectionCheckpoint = {
      id: c.id,
      startedAt: c.startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - c.startMs,

      userMessage: c.userMessage,
      model: c.model,

      assistantResponse: opts.assistantResponse.slice(0, 500),
      filesModified: opts.filesModified,
      commitHash: opts.commitHash,

      toolCalls: c.toolCalls,
      toolCallCount: c.toolCalls.length,
      toolErrorCount: c.toolCalls.filter(t => t.isError).length,
      retryCount: c.toolCalls.filter(t => t.wasRetried).length,

      tokensIn: opts.tokensIn,
      tokensOut: opts.tokensOut,
      costUsd: opts.costUsd,

      turnCount: c.turnCount,
      compactionTriggered: c.compactionTriggered,

      success: opts.success,
      failureReason: opts.failureReason,
      verificationPassed: opts.verificationPassed,
      tscClean: opts.tscClean,
    };

    this._persist(checkpoint);
    return checkpoint;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /** Get the N most recent completed checkpoints (default: 10). */
  getRecent(n = 10): ReflectionCheckpoint[] {
    return this.inMemory.slice(-Math.max(1, n));
  }

  /** Whether a checkpoint is currently in progress. */
  get isActive(): boolean {
    return this.current !== null;
  }

  /**
   * Aggregate statistics across all stored checkpoints.
   * Returns zeroed summary if no checkpoints yet.
   */
  getSummary(): ReflectionSummary {
    const cps = this.inMemory;
    if (cps.length === 0) {
      return { total: 0, successRate: 0, avgDurationMs: 0, avgCostUsd: 0, avgToolCalls: 0, avgRetries: 0, topErrorTools: [] };
    }

    const n = cps.length;
    const successRate = cps.filter(c => c.success).length / n;
    const avgDurationMs = cps.reduce((s, c) => s + c.durationMs, 0) / n;
    const avgCostUsd = cps.reduce((s, c) => s + c.costUsd, 0) / n;
    const avgToolCalls = cps.reduce((s, c) => s + c.toolCallCount, 0) / n;
    const avgRetries = cps.reduce((s, c) => s + c.retryCount, 0) / n;

    // Error frequency by tool name
    const errByTool = new Map<string, number>();
    for (const cp of cps) {
      for (const tc of cp.toolCalls) {
        if (tc.isError) {
          errByTool.set(tc.name, (errByTool.get(tc.name) ?? 0) + 1);
        }
      }
    }
    const topErrorTools = [...errByTool.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { total: n, successRate, avgDurationMs, avgCostUsd, avgToolCalls, avgRetries, topErrorTools };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _persist(cp: ReflectionCheckpoint): void {
    // Update in-memory ring buffer
    this.inMemory.push(cp);
    if (this.inMemory.length > MAX_IN_MEMORY) {
      this.inMemory = this.inMemory.slice(-MAX_IN_MEMORY);
    }

    // Append to JSONL file (non-fatal)
    try {
      mkdirSync(this.dirPath, { recursive: true });
      appendFileSync(this.filePath, JSON.stringify(cp) + "\n", "utf-8");
    } catch {
      // Disk write failure is non-fatal — in-memory state is preserved
    }
  }

  private _loadRecent(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const lines = raw.trim().split("\n").filter(Boolean);
      this.inMemory = lines
        .slice(-MAX_IN_MEMORY)
        .map(l => JSON.parse(l) as ReflectionCheckpoint);
    } catch {
      this.inMemory = [];
    }
  }
}
