/**
 * Session history — records per-session stats to ~/.autoagent/session-history.jsonl
 */

import fs from "fs";
import os from "os";
import path from "path";

export interface SessionHistoryEntry {
  date: string;       // ISO string
  turns: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  firstMessage: string;
  model: string;
}

function historyFilePath(): string {
  const dir = path.join(os.homedir(), ".autoagent");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "session-history.jsonl");
}

export function recordSession(entry: SessionHistoryEntry): void {
  const file = historyFilePath();
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
}

export function getRecentSessions(n = 10): SessionHistoryEntry[] {
  const file = historyFilePath();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  return lines
    .slice(-n)
    .map((line) => {
      try {
        return JSON.parse(line) as SessionHistoryEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is SessionHistoryEntry => e !== null)
    .reverse();
}
