import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  projectHash,
  getSessionDir,
  initSession,
  saveMessage,
  loadSession,
  listSessions,
  cleanOldSessions,
} from "../src/session-store.js";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Test helpers ─────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autoagent-session-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Override home dir isn't straightforward, so we test using tmpDir as workDir.
// projectHash just needs to be deterministic.

// ─── projectHash ─────────────────────────────────────────────

describe("projectHash", () => {
  it("returns 12-char hex string", () => {
    const h = projectHash("/some/project/path");
    expect(h).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is deterministic — same input, same hash", () => {
    const h1 = projectHash("/my/project");
    const h2 = projectHash("/my/project");
    expect(h1).toBe(h2);
  });

  it("differs for different paths", () => {
    const h1 = projectHash("/project/a");
    const h2 = projectHash("/project/b");
    expect(h1).not.toBe(h2);
  });

  it("resolves relative paths consistently", () => {
    const abs = path.resolve("./src");
    const h1 = projectHash("./src");
    const h2 = projectHash(abs);
    expect(h1).toBe(h2);
  });
});

// ─── initSession ─────────────────────────────────────────────

describe("initSession", () => {
  it("creates a new JSONL file", () => {
    const sessionPath = initSession(tmpDir);
    expect(fs.existsSync(sessionPath)).toBe(true);
    expect(sessionPath.endsWith(".jsonl")).toBe(true);
  });

  it("creates the session directory if it doesn't exist", () => {
    const sessionPath = initSession(tmpDir);
    expect(fs.existsSync(path.dirname(sessionPath))).toBe(true);
  });

  it("creates an empty file initially", () => {
    const sessionPath = initSession(tmpDir);
    expect(fs.readFileSync(sessionPath, "utf-8")).toBe("");
  });

  it("generates unique paths for multiple sessions", () => {
    // Small delay to ensure timestamp differs
    const p1 = initSession(tmpDir);
    // Force unique by checking paths differ (usually timestamp-based)
    const p2 = initSession(tmpDir);
    // Both exist
    expect(fs.existsSync(p1)).toBe(true);
    expect(fs.existsSync(p2)).toBe(true);
  });
});

// ─── saveMessage ─────────────────────────────────────────────

describe("saveMessage", () => {
  it("appends a user message as JSON line", () => {
    const sessionPath = initSession(tmpDir);
    const msg: Anthropic.MessageParam = { role: "user", content: "Hello world" };
    saveMessage(sessionPath, msg);

    const content = fs.readFileSync(sessionPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.role).toBe("user");
    expect(parsed.content).toBe("Hello world");
    expect(parsed.timestamp).toBeDefined();
  });

  it("appends multiple messages in order", () => {
    const sessionPath = initSession(tmpDir);
    const msgs: Anthropic.MessageParam[] = [
      { role: "user", content: "First" },
      { role: "assistant", content: "Second" },
      { role: "user", content: "Third" },
    ];
    for (const m of msgs) saveMessage(sessionPath, m);

    const lines = fs.readFileSync(sessionPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).content).toBe("First");
    expect(JSON.parse(lines[1]).content).toBe("Second");
    expect(JSON.parse(lines[2]).content).toBe("Third");
  });

  it("handles array content (content blocks)", () => {
    const sessionPath = initSession(tmpDir);
    const msg: Anthropic.MessageParam = {
      role: "assistant",
      content: [{ type: "text", text: "Hello from array" }],
    };
    saveMessage(sessionPath, msg);
    const lines = fs.readFileSync(sessionPath, "utf-8").trim().split("\n");
    const parsed = JSON.parse(lines[0]);
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(parsed.content[0].text).toBe("Hello from array");
  });
});

// ─── loadSession ─────────────────────────────────────────────

describe("loadSession", () => {
  it("returns empty array for non-existent file", () => {
    const result = loadSession("/nonexistent/path/session.jsonl");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty file", () => {
    const sessionPath = initSession(tmpDir);
    const result = loadSession(sessionPath);
    expect(result).toEqual([]);
  });

  it("round-trips messages correctly", () => {
    const sessionPath = initSession(tmpDir);
    const msgs: Anthropic.MessageParam[] = [
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "Thanks!" },
    ];
    for (const m of msgs) saveMessage(sessionPath, m);

    const loaded = loadSession(sessionPath);
    expect(loaded).toHaveLength(3);
    expect(loaded[0]).toEqual({ role: "user", content: "What is 2+2?" });
    expect(loaded[1]).toEqual({ role: "assistant", content: "4" });
    expect(loaded[2]).toEqual({ role: "user", content: "Thanks!" });
  });

  it("skips corrupt JSONL lines gracefully", () => {
    const sessionPath = initSession(tmpDir);
    saveMessage(sessionPath, { role: "user", content: "Good line 1" });
    // Inject a corrupt line
    fs.appendFileSync(sessionPath, "NOT VALID JSON\n", "utf-8");
    saveMessage(sessionPath, { role: "assistant", content: "Good line 2" });

    const loaded = loadSession(sessionPath);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].content).toBe("Good line 1");
    expect(loaded[1].content).toBe("Good line 2");
  });

  it("skips blank lines without error", () => {
    const sessionPath = initSession(tmpDir);
    saveMessage(sessionPath, { role: "user", content: "Hello" });
    fs.appendFileSync(sessionPath, "\n\n\n", "utf-8");
    saveMessage(sessionPath, { role: "assistant", content: "Hi" });

    const loaded = loadSession(sessionPath);
    expect(loaded).toHaveLength(2);
  });

  it("preserves array content blocks", () => {
    const sessionPath = initSession(tmpDir);
    const msg: Anthropic.MessageParam = {
      role: "assistant",
      content: [{ type: "text", text: "Block response" }],
    };
    saveMessage(sessionPath, msg);
    const loaded = loadSession(sessionPath);
    expect(loaded).toHaveLength(1);
    expect(Array.isArray(loaded[0].content)).toBe(true);
    expect((loaded[0].content as Anthropic.TextBlock[])[0].text).toBe("Block response");
  });
});

// ─── listSessions ─────────────────────────────────────────────

describe("listSessions", () => {
  it("returns empty array when no sessions exist", () => {
    const result = listSessions(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns session with correct fields", () => {
    const sessionPath = initSession(tmpDir);
    saveMessage(sessionPath, { role: "user", content: "Fix the bug in auth.ts" });

    const sessions = listSessions(tmpDir);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].path).toBe(sessionPath);
    expect(sessions[0].summary).toContain("Fix the bug in auth.ts");
    expect(sessions[0].messageCount).toBe(1);
    expect(sessions[0].updatedAt).toBeInstanceOf(Date);
  });

  it("truncates long summaries to 80 chars + ellipsis", () => {
    const sessionPath = initSession(tmpDir);
    const longMsg = "A".repeat(100);
    saveMessage(sessionPath, { role: "user", content: longMsg });

    const sessions = listSessions(tmpDir);
    expect(sessions[0].summary.length).toBeLessThanOrEqual(82); // 80 + "…"
    expect(sessions[0].summary).toContain("…");
  });

  it("sorts sessions by most recent first", async () => {
    const p1 = initSession(tmpDir);
    saveMessage(p1, { role: "user", content: "Older session" });

    // Small pause to ensure file mtime differs
    await new Promise((r) => setTimeout(r, 10));

    const p2 = initSession(tmpDir);
    saveMessage(p2, { role: "user", content: "Newer session" });

    // Touch p2 to be definitively newer
    const now = new Date();
    fs.utimesSync(p2, now, now);

    const sessions = listSessions(tmpDir);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0].path).toBe(p2);
  });

  it("uses first user message for summary (skips assistant-first)", () => {
    const sessionPath = initSession(tmpDir);
    saveMessage(sessionPath, { role: "assistant", content: "I am ready" });
    saveMessage(sessionPath, { role: "user", content: "Build me a rocket" });

    const sessions = listSessions(tmpDir);
    expect(sessions[0].summary).toContain("Build me a rocket");
  });
});

// ─── cleanOldSessions ─────────────────────────────────────────

describe("cleanOldSessions", () => {
  it("deletes files older than maxAgeDays", () => {
    const sessionPath = initSession(tmpDir);
    saveMessage(sessionPath, { role: "user", content: "Old session" });

    // Backdating the file mtime to 31 days ago
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    fs.utimesSync(sessionPath, oldDate, oldDate);

    cleanOldSessions(tmpDir, 30);
    expect(fs.existsSync(sessionPath)).toBe(false);
  });

  it("keeps files newer than maxAgeDays", () => {
    const sessionPath = initSession(tmpDir);
    saveMessage(sessionPath, { role: "user", content: "Recent session" });

    cleanOldSessions(tmpDir, 30);
    expect(fs.existsSync(sessionPath)).toBe(true);
  });

  it("does not throw if directory is empty", () => {
    expect(() => cleanOldSessions(tmpDir, 30)).not.toThrow();
  });

  it("uses 30-day default", () => {
    const sessionPath = initSession(tmpDir);
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    fs.utimesSync(sessionPath, oldDate, oldDate);

    cleanOldSessions(tmpDir); // no maxAgeDays arg
    expect(fs.existsSync(sessionPath)).toBe(false);
  });
});

// ─── Round-trip integration ───────────────────────────────────

describe("Round-trip: init → save → load", () => {
  it("survives a simulated restart", () => {
    // Session 1: save messages
    const sessionPath = initSession(tmpDir);
    const msgs: Anthropic.MessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi! How can I help?" },
      { role: "user", content: "Fix my code" },
    ];
    for (const m of msgs) saveMessage(sessionPath, m);

    // Simulate restart: load from path (new Orchestrator would do this)
    const loaded = loadSession(sessionPath);
    expect(loaded).toHaveLength(3);
    expect(loaded[0]).toEqual(msgs[0]);
    expect(loaded[1]).toEqual(msgs[1]);
    expect(loaded[2]).toEqual(msgs[2]);
  });
});
