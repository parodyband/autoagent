import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printHelp } from "../cli.js";

describe("printHelp", () => {
  let output: string;

  beforeEach(() => {
    output = "";
    vi.spyOn(console, "log").mockImplementation((msg: string) => {
      output += msg;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints AutoAgent header", () => {
    printHelp();
    expect(output).toContain("AutoAgent");
  });

  it("prints CLI subcommands", () => {
    printHelp();
    expect(output).toContain("init");
    expect(output).toContain("help");
  });

  it("prints TUI slash commands", () => {
    printHelp();
    expect(output).toContain("/init");
    expect(output).toContain("/clear");
    expect(output).toContain("/model");
    expect(output).toContain("/export");
    expect(output).toContain("/compact");
  });

  it("prints usage examples", () => {
    printHelp();
    expect(output).toContain("autoagent");
  });
});
