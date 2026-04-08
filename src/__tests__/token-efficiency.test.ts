import { describe, it, expect, beforeEach } from "vitest";
import { Orchestrator } from "../orchestrator.js";

// Access private tokenHistory via casting
type OrchestratorAny = Orchestrator & {
  tokenHistory: Array<{ turn: number; input: number; output: number }>;
};

function makeOrchestrator(): OrchestratorAny {
  // Minimal construction — just needs getTokenEfficiency()
  return new (Orchestrator as any)({ model: "claude-opus-4-5", workDir: "/tmp" }) as OrchestratorAny;
}

describe("getTokenEfficiency", () => {
  let orc: OrchestratorAny;

  beforeEach(() => {
    orc = makeOrchestrator();
  });

  it("returns zeros when history is empty", () => {
    const result = orc.getTokenEfficiency();
    expect(result).toEqual({ avgInput: 0, avgOutput: 0, peakInput: 0, peakTurn: 0, currentUtilPct: 0 });
  });

  it("computes correct averages and peak from 3 entries", () => {
    orc.tokenHistory = [
      { turn: 1, input: 10_000, output: 500 },
      { turn: 2, input: 30_000, output: 1_000 },
      { turn: 3, input: 20_000, output: 750 },
    ];
    const result = orc.getTokenEfficiency();
    expect(result.avgInput).toBe(20_000);
    expect(result.avgOutput).toBe(750);
    expect(result.peakInput).toBe(30_000);
    expect(result.peakTurn).toBe(2);
  });

  it("calculates currentUtilPct from last entry relative to 200K", () => {
    orc.tokenHistory = [
      { turn: 1, input: 50_000, output: 100 },
      { turn: 2, input: 100_000, output: 200 },
    ];
    const result = orc.getTokenEfficiency();
    // last input is 100_000 / 200_000 = 50%
    expect(result.currentUtilPct).toBe(50);
  });

  it("handles single entry correctly", () => {
    orc.tokenHistory = [{ turn: 5, input: 40_000, output: 800 }];
    const result = orc.getTokenEfficiency();
    expect(result.avgInput).toBe(40_000);
    expect(result.avgOutput).toBe(800);
    expect(result.peakInput).toBe(40_000);
    expect(result.peakTurn).toBe(5);
    expect(result.currentUtilPct).toBe(20);
  });
});
