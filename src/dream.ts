/**
 * Dream Task — background memory consolidation.
 *
 * Reads recent session logs and existing memory, uses Claude to extract
 * patterns, merge duplicates, prune stale entries, and write back.
 */

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_HAIKU } from "./models.js";

// ─── Types ──────────────────────────────────────────────────

export interface DreamResult {
  added: number;
  removed: number;
}

/** Minimal fs interface for dependency injection in tests. */
export interface FsLike {
  existsSync(p: string): boolean;
  readFileSync(p: string, enc: "utf8"): string;
  writeFileSync(p: string, data: string, enc: "utf8"): void;
}

// ─── Core consolidation ─────────────────────────────────────

const CONSOLIDATE_PROMPT = `You are a memory consolidation system for a coding agent.

Given the EXISTING MEMORY and a RECENT SESSION LOG, produce an updated memory document that:
1. Extracts new patterns/lessons from the session log (add them if genuinely new)
2. Merges duplicate entries (same concept stated multiple times → keep best version)
3. Prunes entries that are contradicted by newer evidence or are no longer relevant
4. Keeps entries organised under these categories (## headings): Key Patterns, Product Architecture, Product Roadmap, Prediction Accuracy, Compacted History
5. Does NOT add trivia — only durable, reusable insights

Respond with ONLY the updated memory markdown. No preamble, no explanation.`;

/**
 * Consolidate memory using Claude.
 *
 * @param sessionLog  Recent agentlog.md or conversation excerpt
 * @param existingMemory  Current .autoagent.md content
 * @param client  Anthropic client
 * @returns Updated memory markdown
 */
export async function consolidateMemory(
  sessionLog: string,
  existingMemory: string,
  client: Anthropic,
): Promise<string> {
  const userMessage = `EXISTING MEMORY:\n\`\`\`\n${existingMemory}\n\`\`\`\n\nRECENT SESSION LOG:\n\`\`\`\n${sessionLog.slice(0, 8000)}\n\`\`\``;

  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 4096,
    messages: [
      { role: "user", content: `${CONSOLIDATE_PROMPT}\n\n${userMessage}` },
    ],
  });

  const block = response.content.find(b => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("dream: no text response from model");
  }
  return block.text.trim();
}

// ─── File I/O ───────────────────────────────────────────────

/**
 * Count bullet/heading entries in a memory string.
 */
function countEntries(mem: string): number {
  return (mem.match(/^[-*#]/gm) ?? []).length;
}

/**
 * Run the dream consolidation cycle for a working directory.
 *
 * @param workDir  Project root directory
 * @param client   Anthropic client
 * @param fsImpl   Optional fs implementation (for testing)
 */
export async function runDream(
  workDir: string,
  client: Anthropic,
  fsImpl: FsLike = fs as FsLike,
): Promise<DreamResult> {
  const memoryPath = path.join(workDir, ".autoagent.md");
  const logPath = path.join(workDir, "agentlog.md");

  const existingMemory = fsImpl.existsSync(memoryPath)
    ? fsImpl.readFileSync(memoryPath, "utf8")
    : "";

  const sessionLog = fsImpl.existsSync(logPath)
    ? fsImpl.readFileSync(logPath, "utf8").slice(-12000)
    : "";

  if (!existingMemory && !sessionLog) {
    return { added: 0, removed: 0 };
  }

  const before = countEntries(existingMemory);
  const updated = await consolidateMemory(sessionLog, existingMemory, client);
  const after = countEntries(updated);

  fsImpl.writeFileSync(memoryPath, updated, "utf8");

  return {
    added: Math.max(0, after - before),
    removed: Math.max(0, before - after),
  };
}
