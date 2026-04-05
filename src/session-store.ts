/**
 * Session Persistence for AutoAgent
 *
 * Saves conversation history to JSONL files so sessions survive restarts.
 * Storage: ~/.autoagent/sessions/{project-hash}/{timestamp}.jsonl
 *
 * Each line: {"type":"user"|"assistant"|"tool_use"|"tool_result","content":...,"timestamp":...}
 */

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Types ───────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  path: string;
  summary: string;
  updatedAt: Date;
  messageCount: number;
}

interface SessionLine {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
  timestamp: string;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Deterministic 12-char hex hash of the absolute project path.
 */
export function projectHash(workDir: string): string {
  return crypto
    .createHash("sha256")
    .update(path.resolve(workDir))
    .digest("hex")
    .slice(0, 12);
}

/**
 * Returns the session directory for a given workDir.
 * Creates it if it doesn't exist.
 */
export function getSessionDir(workDir: string): string {
  const dir = path.join(os.homedir(), ".autoagent", "sessions", projectHash(workDir));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Extract a short summary from the first user message in a session.
 */
function extractSummary(lines: SessionLine[]): string {
  for (const line of lines) {
    if (line.role === "user") {
      const text =
        typeof line.content === "string"
          ? line.content
          : Array.isArray(line.content)
          ? line.content
              .map((b) => (typeof b === "object" && "text" in b ? b.text : ""))
              .filter(Boolean)
              .join(" ")
          : "";
      return text.slice(0, 80) + (text.length > 80 ? "…" : "");
    }
  }
  return "(empty session)";
}

// ─── Core API ─────────────────────────────────────────────────

/**
 * Create a new session file. Returns the path to the JSONL file.
 */
export function initSession(workDir: string): string {
  const dir = getSessionDir(workDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionPath = path.join(dir, `${timestamp}.jsonl`);
  // Create the file (empty)
  fs.writeFileSync(sessionPath, "", "utf-8");
  return sessionPath;
}

/**
 * Append a single MessageParam to the JSONL session file.
 */
export function saveMessage(
  sessionPath: string,
  msg: Anthropic.MessageParam
): void {
  const line: SessionLine = {
    role: msg.role,
    content: msg.content,
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(sessionPath, JSON.stringify(line) + "\n", "utf-8");
}

/**
 * Load a session from a JSONL file into MessageParam[].
 * Skips corrupt/unparseable lines gracefully.
 */
export function loadSession(sessionPath: string): Anthropic.MessageParam[] {
  if (!fs.existsSync(sessionPath)) return [];

  const raw = fs.readFileSync(sessionPath, "utf-8");
  const messages: Anthropic.MessageParam[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as SessionLine;
      if (parsed.role && parsed.content !== undefined) {
        messages.push({ role: parsed.role, content: parsed.content });
      }
    } catch {
      // Skip corrupt lines — don't crash
    }
  }

  return messages;
}

/**
 * List all sessions for a project, sorted by most recent first.
 */
export function listSessions(workDir: string): SessionInfo[] {
  const dir = getSessionDir(workDir);
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }

  const sessions: SessionInfo[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      const raw = fs.readFileSync(filePath, "utf-8");
      const lines: SessionLine[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as SessionLine;
          if (parsed.role) lines.push(parsed);
        } catch {
          // skip
        }
      }
      const id = file.replace(".jsonl", "");
      sessions.push({
        id,
        path: filePath,
        summary: extractSummary(lines),
        updatedAt: stat.mtime,
        messageCount: lines.length,
      });
    } catch {
      // skip unreadable files
    }
  }

  return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Delete session files older than maxAgeDays (default: 30).
 * Non-blocking — errors are silently ignored.
 */
export function cleanOldSessions(workDir: string, maxAgeDays = 30): void {
  const dir = getSessionDir(workDir);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return;
  }

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtime.getTime() < cutoff) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }
}
