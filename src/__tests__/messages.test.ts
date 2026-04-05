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
  // ── Fallback (no budget) ──────────────────────────────────
  it("returns null for non-checkpoint turns (no budget)", () => {
    expect(progressCheckpoint(1)).toBeNull();
    expect(progressCheckpoint(5)).toBeNull();
    expect(progressCheckpoint(10)).toBeNull();
    expect(progressCheckpoint(12)).toBeNull();
  });

  it("returns early checkpoint at turn 4 (no budget)", () => {
    const result = progressCheckpoint(4);
    expect(result).not.toBeNull();
    expect(result).toContain("4");
  });

  it("returns checkpoint at turn 8 (no budget)", () => {
    const result = progressCheckpoint(8);
    expect(result).not.toBeNull();
    expect(result).toContain("8");
  });

  it("returns checkpoint at turn 15 (no budget)", () => {
    const result = progressCheckpoint(15);
    expect(result).not.toBeNull();
    expect(result).toContain("15");
  });

  it("returns FINAL WARNING at turn 20 (no budget)", () => {
    const result = progressCheckpoint(20);
    expect(result).not.toBeNull();
    expect(result).toContain("20");
    expect(result).toContain("FINAL");
  });

  it("includes cognitive metrics block when provided (no budget)", () => {
    const metrics = {
      inputTokens: 8000,
      outputTokens: 4000,
      readCalls: 5,
      writeCalls: 2,
      totalCalls: 7,
      turns: 8,
    };
    const result = progressCheckpoint(8, null, undefined, metrics);
    expect(result).toContain("Cognitive metrics");
  });

  it("omits metrics block when not provided (no budget)", () => {
    const result = progressCheckpoint(8);
    expect(result).not.toContain("Cognitive metrics");
  });

  // ── Budget 14 ─────────────────────────────────────────────
  // t1=round(14*0.15)=2, t2=max(3,round(14*0.32))=max(3,4)=4
  // t3=max(5,round(14*0.60))=max(5,8)=8, t4=max(9,round(14*0.80))=max(9,11)=11
  it("budget 14: early checkpoint at turn 2", () => {
    const result = progressCheckpoint(2, 14, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("Early checkpoint");
    expect(result).toContain("Turn 2/25");
  });

  it("budget 14: progress checkpoint at turn 4", () => {
    const result = progressCheckpoint(4, 14, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("Progress checkpoint");
    expect(result).toContain("Turn 4/25");
  });

  it("budget 14: past halfway at turn 8", () => {
    const result = progressCheckpoint(8, 14, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("Past halfway");
    expect(result).toContain("Turn 8/25");
  });

  it("budget 14: final warning at turn 11", () => {
    const result = progressCheckpoint(11, 14, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("FINAL WARNING");
    expect(result).toContain("Turn 11/25");
  });

  it("budget 14: returns null at turns that are not checkpoints", () => {
    expect(progressCheckpoint(1, 14, 25)).toBeNull();
    expect(progressCheckpoint(3, 14, 25)).toBeNull();
    expect(progressCheckpoint(5, 14, 25)).toBeNull();
    expect(progressCheckpoint(9, 14, 25)).toBeNull();
  });

  // ── Budget 22 ─────────────────────────────────────────────
  // t1=round(22*0.15)=3, t2=max(4,round(22*0.32))=max(4,7)=7
  // t3=max(8,round(22*0.60))=max(8,13)=13, t4=max(14,round(22*0.80))=max(14,18)=18
  it("budget 22: early checkpoint at turn 3", () => {
    const result = progressCheckpoint(3, 22, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("Early checkpoint");
    expect(result).toContain("Turn 3/25");
  });

  it("budget 22: progress checkpoint at turn 7", () => {
    const result = progressCheckpoint(7, 22, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("Progress checkpoint");
    expect(result).toContain("Turn 7/25");
  });

  it("budget 22: past halfway at turn 13", () => {
    const result = progressCheckpoint(13, 22, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("Past halfway");
    expect(result).toContain("Turn 13/25");
  });

  it("budget 22: final warning at turn 18", () => {
    const result = progressCheckpoint(18, 22, 25);
    expect(result).not.toBeNull();
    expect(result).toContain("FINAL WARNING");
    expect(result).toContain("Turn 18/25");
  });

  it("budget 22: returns null at turns that are not checkpoints", () => {
    expect(progressCheckpoint(4, 22, 25)).toBeNull();
    expect(progressCheckpoint(8, 22, 25)).toBeNull();
    expect(progressCheckpoint(15, 22, 25)).toBeNull();
    expect(progressCheckpoint(20, 22, 25)).toBeNull();
  });

  // ── Metrics with budget ───────────────────────────────────
  it("includes cognitive metrics block when budget provided", () => {
    const metrics = {
      inputTokens: 8000,
      outputTokens: 4000,
      readCalls: 5,
      writeCalls: 2,
      totalCalls: 7,
      turns: 7,
    };
    const result = progressCheckpoint(7, 22, 25, metrics);
    expect(result).toContain("Cognitive metrics");
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
