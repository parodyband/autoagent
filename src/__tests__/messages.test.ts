import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  buildSystemPrompt,
  buildBuilderSystemPrompt,
  budgetWarning,
  progressCheckpoint,
  turnLimitNudge,
  validationBlockedMessage,
} from "../messages.js";
import type { IterationState } from "../iteration.js";

const state: IterationState = {
  iteration: 42,
  lastSuccessfulIteration: 41,
  lastFailedCommit: null,
  lastFailureReason: null,
};

// ─── buildSystemPrompt ───────────────────────────────────────

describe("buildSystemPrompt", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "messages-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads system-prompt.md and substitutes {{ITERATION}}", () => {
    writeFileSync(join(tmpDir, "system-prompt.md"), "Iteration: {{ITERATION}}");
    const result = buildSystemPrompt(state, tmpDir);
    expect(result).toBe("Iteration: 42");
  });

  it("substitutes {{ROOT}}", () => {
    writeFileSync(join(tmpDir, "system-prompt.md"), "Root: {{ROOT}}");
    const result = buildSystemPrompt(state, tmpDir);
    expect(result).toContain(tmpDir);
  });

  it("substitutes {{LAST_SUCCESSFUL}}", () => {
    writeFileSync(join(tmpDir, "system-prompt.md"), "Last: {{LAST_SUCCESSFUL}}");
    const result = buildSystemPrompt(state, tmpDir);
    expect(result).toBe("Last: 41");
  });

  it("substitutes {{LAST_FAILED_COMMIT}} with 'none' when null", () => {
    writeFileSync(join(tmpDir, "system-prompt.md"), "Failed: {{LAST_FAILED_COMMIT}}");
    const result = buildSystemPrompt(state, tmpDir);
    expect(result).toBe("Failed: none");
  });

  it("substitutes {{LAST_FAILURE_REASON}} with actual value when set", () => {
    writeFileSync(join(tmpDir, "system-prompt.md"), "Reason: {{LAST_FAILURE_REASON}}");
    const stateWithReason = { ...state, lastFailureReason: "tsc failed" };
    const result = buildSystemPrompt(stateWithReason, tmpDir);
    expect(result).toBe("Reason: tsc failed");
  });

  it("substitutes multiple placeholders in one pass", () => {
    writeFileSync(join(tmpDir, "system-prompt.md"), "{{ITERATION}} / {{LAST_SUCCESSFUL}}");
    const result = buildSystemPrompt(state, tmpDir);
    expect(result).toBe("42 / 41");
  });

  it("returns fallback when system-prompt.md does not exist", () => {
    const result = buildSystemPrompt(state, tmpDir);
    expect(result).toContain("42");
    expect(result).toContain("AutoAgent");
  });
});

// ─── buildBuilderSystemPrompt ────────────────────────────────

describe("buildBuilderSystemPrompt", () => {
  it("includes the iteration number", () => {
    const result = buildBuilderSystemPrompt(state, "/some/dir");
    expect(result).toContain("42");
  });

  it("includes the rootDir", () => {
    const result = buildBuilderSystemPrompt(state, "/some/dir");
    expect(result).toContain("/some/dir");
  });

  it("includes lastSuccessfulIteration", () => {
    const result = buildBuilderSystemPrompt(state, "/some/dir");
    expect(result).toContain("41");
  });

  it("includes lastFailedCommit when set", () => {
    const s = { ...state, lastFailedCommit: "abc123" };
    const result = buildBuilderSystemPrompt(s, "/some/dir");
    expect(result).toContain("abc123");
  });

  it("includes lastFailureReason when set", () => {
    const s = { ...state, lastFailureReason: "compile error" };
    const result = buildBuilderSystemPrompt(s, "/some/dir");
    expect(result).toContain("compile error");
  });

  it("returns a non-empty string", () => {
    const result = buildBuilderSystemPrompt(state, "/some/dir");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(50);
  });
});

// ─── budgetWarning ───────────────────────────────────────────

describe("budgetWarning", () => {
  const stats = {
    inputTokens: 10000,
    outputTokens: 5000,
    cacheReadTokens: 3000,
    elapsedMs: 45000,
  };

  it("returns null for turns not in [15, 25, 35]", () => {
    expect(budgetWarning(1, 40, stats)).toBeNull();
    expect(budgetWarning(10, 40, stats)).toBeNull();
    expect(budgetWarning(20, 40, stats)).toBeNull();
  });

  it("returns warning string at turn 15", () => {
    const result = budgetWarning(15, 40, stats);
    expect(result).not.toBeNull();
    expect(result).toContain("15");
  });

  it("returns warning string at turn 25", () => {
    const result = budgetWarning(25, 40, stats);
    expect(result).not.toBeNull();
    expect(result).toContain("25");
  });

  it("returns warning string at turn 35", () => {
    const result = budgetWarning(35, 40, stats);
    expect(result).not.toBeNull();
    expect(result).toContain("35");
  });

  it("includes token counts in the warning", () => {
    const result = budgetWarning(15, 40, stats);
    expect(result).toContain("10.0K");
    expect(result).toContain("5.0K");
  });

  it("includes cache read hits", () => {
    const result = budgetWarning(15, 40, stats);
    expect(result).toContain("3.0K");
  });

  it("includes elapsed time", () => {
    const result = budgetWarning(15, 40, stats);
    expect(result).toContain("45s");
  });
});

// ─── progressCheckpoint ──────────────────────────────────────

describe("progressCheckpoint", () => {
  it("returns null for non-checkpoint turns", () => {
    expect(progressCheckpoint(1)).toBeNull();
    expect(progressCheckpoint(5)).toBeNull();
    expect(progressCheckpoint(10)).toBeNull();
    expect(progressCheckpoint(12)).toBeNull();
  });

  it("returns early checkpoint at turn 4", () => {
    const result = progressCheckpoint(4);
    expect(result).not.toBeNull();
    expect(result).toContain("4");
  });

  it("returns checkpoint at turn 8", () => {
    const result = progressCheckpoint(8);
    expect(result).not.toBeNull();
    expect(result).toContain("8");
  });

  it("returns checkpoint at turn 15", () => {
    const result = progressCheckpoint(15);
    expect(result).not.toBeNull();
    expect(result).toContain("15");
  });

  it("returns FINAL WARNING at turn 20", () => {
    const result = progressCheckpoint(20);
    expect(result).not.toBeNull();
    expect(result).toContain("20");
    expect(result).toContain("FINAL");
  });

  it("includes cognitive metrics block when provided", () => {
    const metrics = {
      inputTokens: 8000,
      outputTokens: 4000,
      readCalls: 5,
      writeCalls: 2,
      totalCalls: 7,
      turns: 8,
    };
    const result = progressCheckpoint(8, metrics);
    expect(result).toContain("Cognitive metrics");
  });

  it("omits metrics block when not provided", () => {
    const result = progressCheckpoint(8);
    expect(result).not.toContain("Cognitive metrics");
  });
});

// ─── turnLimitNudge ──────────────────────────────────────────

describe("turnLimitNudge", () => {
  it("returns null when turns left is not a trigger value", () => {
    expect(turnLimitNudge(20)).toBeNull();
    expect(turnLimitNudge(5)).toBeNull();
    expect(turnLimitNudge(1)).toBeNull();
  });

  it("returns nudge when 10 turns left", () => {
    const result = turnLimitNudge(10);
    expect(result).not.toBeNull();
    expect(result).toContain("10");
  });

  it("returns urgent nudge when 3 turns left", () => {
    const result = turnLimitNudge(3);
    expect(result).not.toBeNull();
    expect(result).toContain("3");
    expect(result).toContain("URGENT");
  });
});

// ─── validationBlockedMessage ────────────────────────────────

describe("validationBlockedMessage", () => {
  it("includes the validation output", () => {
    const result = validationBlockedMessage("error TS2345: something wrong");
    expect(result).toContain("error TS2345");
  });

  it("includes BLOCKED keyword", () => {
    const result = validationBlockedMessage("some error");
    expect(result).toContain("BLOCKED");
  });

  it("truncates very long output to ~2000 chars", () => {
    const longOutput = "x".repeat(5000);
    const result = validationBlockedMessage(longOutput);
    expect(result.length).toBeLessThan(longOutput.length);
  });

  it("instructs agent to fix and restart", () => {
    const result = validationBlockedMessage("error");
    expect(result).toContain("AUTOAGENT_RESTART");
  });
});
