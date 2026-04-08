import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// We'll override the home dir by mocking os.homedir
const tmpDir = path.join(os.tmpdir(), "autoagent-test-session-history-" + process.pid);
const historyFile = path.join(tmpDir, ".autoagent", "session-history.jsonl");

vi.mock("os", async () => {
  const actual = await import("os");
  return { ...actual, default: { ...actual.default, homedir: () => tmpDir } };
});

describe("session-history", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(tmpDir, ".autoagent"), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
    fs.rmSync(path.join(tmpDir, ".autoagent"), { recursive: true, force: true });
  });

  it("recordSession writes a JSON line", async () => {
    const { recordSession } = await import("../session-history.js");
    recordSession({
      date: "2025-01-15T10:00:00.000Z",
      turns: 5,
      cost: 0.12,
      inputTokens: 1000,
      outputTokens: 500,
      firstMessage: "Fix the login bug",
      model: "claude-opus-4-5",
    });
    const content = fs.readFileSync(historyFile, "utf8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.turns).toBe(5);
    expect(parsed.firstMessage).toBe("Fix the login bug");
  });

  it("getRecentSessions returns entries in reverse chronological order", async () => {
    const { recordSession, getRecentSessions } = await import("../session-history.js");
    recordSession({ date: "2025-01-01T00:00:00.000Z", turns: 3, cost: 0.05, inputTokens: 100, outputTokens: 50, firstMessage: "first", model: "m1" });
    recordSession({ date: "2025-01-02T00:00:00.000Z", turns: 7, cost: 0.10, inputTokens: 200, outputTokens: 100, firstMessage: "second", model: "m1" });
    const sessions = getRecentSessions(10);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].firstMessage).toBe("second"); // most recent first
    expect(sessions[1].firstMessage).toBe("first");
  });

  it("getRecentSessions returns empty array when no file", async () => {
    const { getRecentSessions } = await import("../session-history.js");
    const sessions = getRecentSessions(10);
    expect(sessions).toEqual([]);
  });

  it("getRecentSessions respects n limit", async () => {
    const { recordSession, getRecentSessions } = await import("../session-history.js");
    for (let i = 0; i < 15; i++) {
      recordSession({ date: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, turns: i, cost: 0.01 * i, inputTokens: i * 10, outputTokens: i * 5, firstMessage: `msg ${i}`, model: "m" });
    }
    const sessions = getRecentSessions(5);
    expect(sessions).toHaveLength(5);
  });
});
