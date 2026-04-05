/**
 * Tests for Orchestrator.getSessionStats()
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../orchestrator.js";

vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

function makeOrchestrator(): Orchestrator {
  return new Orchestrator({ workDir: "/tmp", autoCommit: false });
}

function pushCosts(orch: Orchestrator, costs: number[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = (orch as any).turnCosts as number[];
  arr.push(...costs);
}

describe("Orchestrator.getSessionStats()", () => {
  let orch: Orchestrator;

  beforeEach(() => {
    orch = makeOrchestrator();
  });

  it("returns durationMs >= 0 after construction", () => {
    const stats = orch.getSessionStats();
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns turnCount = 0 and avgCostPerTurn = 0 when no turns", () => {
    const stats = orch.getSessionStats();
    expect(stats.turnCount).toBe(0);
    expect(stats.avgCostPerTurn).toBe(0);
  });

  it("avgCostPerTurn is correct after pushing costs", () => {
    pushCosts(orch, [0.01, 0.03]);
    const stats = orch.getSessionStats();
    expect(stats.turnCount).toBe(2);
    expect(stats.avgCostPerTurn).toBeCloseTo(0.02, 4);
  });

  it("costTrend returns → when fewer than 3 turns", () => {
    pushCosts(orch, [0.05, 0.05]);
    const stats = orch.getSessionStats();
    expect(stats.costTrend).toBe("→");
  });

  it("costTrend returns → when costs are uniform", () => {
    pushCosts(orch, [0.01, 0.01, 0.01, 0.01, 0.01]);
    const stats = orch.getSessionStats();
    expect(stats.costTrend).toBe("→");
  });

  it("costTrend returns ↑ when recent costs are >1.2x overall avg", () => {
    // avg = (0.01*3 + 0.06*3)/6 = 0.035, last3 avg = 0.06 → 0.06/0.035 ≈ 1.71 > 1.2 → ↑
    pushCosts(orch, [0.01, 0.01, 0.01, 0.06, 0.06, 0.06]);
    const stats = orch.getSessionStats();
    expect(stats.costTrend).toBe("↑");
  });

  it("costTrend returns ↓ when recent costs are <0.8x overall avg", () => {
    // avg = (0.10*3 + 0.01*3)/6 = 0.055, last3 avg = 0.01 → 0.01/0.055 ≈ 0.18 < 0.8 → ↓
    pushCosts(orch, [0.10, 0.10, 0.10, 0.01, 0.01, 0.01]);
    const stats = orch.getSessionStats();
    expect(stats.costTrend).toBe("↓");
  });

  it("durationMs grows over time", async () => {
    const stats1 = orch.getSessionStats();
    await new Promise(r => setTimeout(r, 20));
    const stats2 = orch.getSessionStats();
    expect(stats2.durationMs).toBeGreaterThan(stats1.durationMs);
  });
});
