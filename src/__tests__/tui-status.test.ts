/**
 * Tests for /status TUI command logic.
 *
 * We test the pure formatting/output logic without spinning up React/Ink.
 */

import { describe, it, expect } from "vitest";

// ─── Extract the /status formatting logic from tui.tsx ────────

interface FooterStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
}

function formatStatusOutput(turns: number, stats: FooterStats): string {
  const costStr = stats.cost < 0.01
    ? `$${stats.cost.toFixed(4)}`
    : `$${stats.cost.toFixed(2)}`;
  return [
    "Session Status:",
    `  Turns:      ${turns}`,
    `  Tokens in:  ${stats.tokensIn.toLocaleString()}`,
    `  Tokens out: ${stats.tokensOut.toLocaleString()}`,
    `  Cost:       ${costStr}`,
    `  Model:      ${stats.model}`,
  ].join("\n");
}

function isStatusCommand(input: string): boolean {
  return input.trim() === "/status";
}

describe("/status command recognition", () => {
  it("recognizes /status as a command", () => {
    expect(isStatusCommand("/status")).toBe(true);
  });

  it("rejects similar but wrong commands", () => {
    expect(isStatusCommand("/statusx")).toBe(false);
    expect(isStatusCommand("/stat")).toBe(false);
    expect(isStatusCommand("status")).toBe(false);
  });

  it("handles whitespace around /status", () => {
    expect(isStatusCommand("  /status  ")).toBe(true);
  });
});

describe("/status output formatting", () => {
  it("includes all required fields: tokens, cost, model", () => {
    const output = formatStatusOutput(5, {
      tokensIn: 12345,
      tokensOut: 678,
      cost: 0.0523,
      model: "claude-sonnet-4-6",
    });
    expect(output).toContain("Tokens in:");
    expect(output).toContain("12,345");
    expect(output).toContain("Tokens out:");
    expect(output).toContain("678");
    expect(output).toContain("Cost:");
    expect(output).toContain("$0.05");
    expect(output).toContain("Model:");
    expect(output).toContain("claude-sonnet-4-6");
    expect(output).toContain("Turns:");
    expect(output).toContain("5");
  });

  it("formats small costs with 4 decimal places", () => {
    const output = formatStatusOutput(1, {
      tokensIn: 100,
      tokensOut: 50,
      cost: 0.0012,
      model: "claude-haiku-4-5",
    });
    expect(output).toContain("$0.0012");
  });

  it("formats larger costs with 2 decimal places", () => {
    const output = formatStatusOutput(10, {
      tokensIn: 500000,
      tokensOut: 50000,
      cost: 1.47,
      model: "claude-sonnet-4-6",
    });
    expect(output).toContain("$1.47");
  });

  it("shows zero turns for fresh session", () => {
    const output = formatStatusOutput(0, {
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      model: "auto",
    });
    expect(output).toContain("Turns:      0");
    expect(output).toContain("Tokens in:  0");
    expect(output).toContain("$0.0000");
  });
});
