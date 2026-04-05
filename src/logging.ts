/**
 * Structured Logging Module
 *
 * Provides JSON Lines logging (.jsonl) for machine analysis alongside
 * human-readable console output. Each log entry includes timestamp,
 * iteration, turn, level, message, and optional metadata.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  iteration: number;
  turn?: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LoggerOptions {
  iteration: number;
  /** Path for JSON Lines structured log file */
  jsonlPath: string;
  /** Path for human-readable markdown log file */
  humanPath: string;
  /** Also write to console (default: true) */
  console?: boolean;
}

// ─── Logger ─────────────────────────────────────────────────

export class Logger {
  private iteration: number;
  private turn = 0;
  private jsonlPath: string;
  private humanPath: string;
  private useConsole: boolean;

  constructor(options: LoggerOptions) {
    this.iteration = options.iteration;
    this.jsonlPath = options.jsonlPath;
    this.humanPath = options.humanPath;
    this.useConsole = options.console !== false;
  }

  setTurn(turn: number): void {
    this.turn = turn;
  }

  getTurn(): number {
    return this.turn;
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write("error", message, metadata);
  }

  /** Backward-compatible simple log (defaults to info level) */
  log(message: string, metadata?: Record<string, unknown>): void {
    this.info(message, metadata);
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      iteration: this.iteration,
      level,
      message,
    };
    if (this.turn > 0) entry.turn = this.turn;
    if (metadata && Object.keys(metadata).length > 0) entry.metadata = metadata;

    // JSON Lines (one JSON object per line)
    try {
      appendFileSync(this.jsonlPath, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      // silently ignore write failures
    }

    // Human-readable markdown log
    const humanLine = `[${entry.timestamp}] iter=${this.iteration}${this.turn > 0 ? ` turn=${this.turn}` : ""} ${level.toUpperCase()}: ${message}\n`;
    try {
      appendFileSync(this.humanPath, humanLine, "utf-8");
    } catch {
      // silently ignore write failures
    }

    // Console output (colored by level)
    if (this.useConsole) {
      const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : " ";
      console.log(`${prefix} ${message}`);
    }
  }
}

// ─── Factory ────────────────────────────────────────────────

/** Create a Logger with standard paths relative to project root. Rotates logs automatically. */
export function createLogger(iteration: number, rootDir: string, options?: { console?: boolean; rotate?: boolean }): Logger {
  const jsonlPath = path.join(rootDir, "agentlog.jsonl");
  const humanPath = path.join(rootDir, "agentlog.md");

  // Rotate logs at the start of each iteration (unless explicitly disabled)
  if (options?.rotate !== false) {
    rotateLogFile(jsonlPath, LOG_ROTATION_LIMITS.jsonl);
    rotateLogFile(humanPath, LOG_ROTATION_LIMITS.human);
  }

  return new Logger({
    iteration,
    jsonlPath,
    humanPath,
    console: options?.console,
  });
}

// ─── Log Rotation ───────────────────────────────────────────

/**
 * Rotate a log file by keeping only the last `maxLines` lines.
 * Returns the number of lines removed, or 0 if no rotation was needed.
 */
export function rotateLogFile(filePath: string, maxLines: number): number {
  if (!existsSync(filePath)) return 0;
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  // Don't count trailing empty line from final newline
  const effectiveLines = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  if (effectiveLines <= maxLines) return 0;
  const removedCount = effectiveLines - maxLines;
  const kept = lines.slice(removedCount);
  writeFileSync(filePath, kept.join("\n"), "utf-8");
  return removedCount;
}

/** Default rotation limits */
export const LOG_ROTATION_LIMITS = {
  jsonl: 500,
  human: 1000,
} as const;

// ─── Utilities ──────────────────────────────────────────────

/** Parse a JSONL log file into LogEntry objects */
export function parseJsonlLog(filePath: string): LogEntry[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  const entries: LogEntry[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}
