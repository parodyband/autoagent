/**
 * Tests for `autoagent help` CLI subcommand (iter 320 feature).
 */

import { describe, it, expect, vi } from "vitest";
import { printHelp } from "../src/cli.js";

describe("printHelp", () => {
  it("prints known TUI commands to stdout", () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => logs.push(args.join(" ")));
    printHelp();
    const output = logs.join("\n");
    expect(output).toContain("/help");
    expect(output).toContain("/diff");
    expect(output).toContain("/undo");
    expect(output).toContain("/export");
    expect(output).toContain("/find");
    expect(output).toContain("/model");
    expect(output).toContain("/status");
    expect(output).toContain("/rewind");
    expect(output).toContain("/clear");
    expect(output).toContain("/reindex");
    expect(output).toContain("/resume");
    expect(output).toContain("/exit");
    vi.restoreAllMocks();
  });

  it("prints CLI subcommands init and help", () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => logs.push(args.join(" ")));
    printHelp();
    const output = logs.join("\n");
    expect(output).toContain("init");
    expect(output).toContain("help");
    expect(output).toContain("autoagent");
    vi.restoreAllMocks();
  });
});
