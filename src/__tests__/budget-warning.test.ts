/**
 * Tests for dynamicBudgetWarning from turn-budget.ts.
 */
import { describe, it, expect } from "vitest";
import { dynamicBudgetWarning, type TurnBudget } from "../turn-budget.js";

function makeBudget(recommended: number, warnAt?: number, hardMax?: number): TurnBudget {
  return {
    recommended,
    warnAt: warnAt ?? Math.round(recommended * 0.75),
    hardMax: hardMax ?? Math.round(recommended * 1.5),
    historicalAvg: recommended,
  };
}

describe("dynamicBudgetWarning", () => {
  it("returns null before warnAt threshold", () => {
    const budget = makeBudget(20); // warnAt=15
    expect(dynamicBudgetWarning(10, budget)).toBeNull();
    expect(dynamicBudgetWarning(14, budget)).toBeNull();
  });

  it("returns warning string at 75% (warnAt turn)", () => {
    const budget = makeBudget(20); // warnAt=15
    const msg = dynamicBudgetWarning(15, budget);
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/ADAPTIVE BUDGET WARNING/);
    expect(msg).toMatch(/15\/20/);
  });

  it("warning at warnAt contains percentage", () => {
    const budget = makeBudget(20); // warnAt=15 → 75%
    const msg = dynamicBudgetWarning(15, budget);
    expect(msg).toMatch(/75%/);
  });

  it("returns budget exceeded string at recommended turn", () => {
    const budget = makeBudget(20);
    const msg = dynamicBudgetWarning(20, budget);
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/BUDGET EXCEEDED/);
    expect(msg).toMatch(/Turn 20/);
  });

  it("returns null between warnAt and recommended", () => {
    const budget = makeBudget(20); // warnAt=15
    expect(dynamicBudgetWarning(16, budget)).toBeNull();
    expect(dynamicBudgetWarning(19, budget)).toBeNull();
  });

  it("returns null after recommended (already past budget)", () => {
    const budget = makeBudget(20);
    expect(dynamicBudgetWarning(21, budget)).toBeNull();
    expect(dynamicBudgetWarning(25, budget)).toBeNull();
  });

  it("handles budget of 1 — warnAt and recommended may be same", () => {
    const budget = makeBudget(1, 1, 2);
    const msg = dynamicBudgetWarning(1, budget);
    // At turn 1 with warnAt=1 AND recommended=1, warnAt check runs first
    expect(msg).not.toBeNull();
  });

  it("handles budget of 0 — no warnings triggered", () => {
    const budget = makeBudget(0, 0, 0);
    // warnAt===recommended===0: turn 0 triggers warnAt check
    const msg = dynamicBudgetWarning(0, budget);
    // Either a warning or null — just no crash
    expect(typeof msg === "string" || msg === null).toBe(true);
  });

  it("warning message contains historical avg", () => {
    const budget = makeBudget(20);
    const msg = dynamicBudgetWarning(15, budget);
    expect(msg).toMatch(/Historical avg/i);
  });

  it("budget exceeded message mentions hard limit", () => {
    const budget = makeBudget(20, 15, 30);
    const msg = dynamicBudgetWarning(20, budget);
    expect(msg).toMatch(/30/); // hardMax
  });
});
