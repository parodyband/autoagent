import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildExportContent } from "../src/export-helper.js";
import { readFileSync, existsSync, rmSync } from "fs";
import path from "path";
import os from "os";

function makeTempDir(): string {
  return os.tmpdir() + "/autoagent-export-test-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

describe("buildExportContent", () => {
  let tmpDir: string;
  let exportPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    exportPath = path.join(tmpDir, ".autoagent", "exports", "session-test.md");
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates directories and writes the file", () => {
    buildExportContent([], "claude-3-5-sonnet-20241022", { tokensIn: 0, tokensOut: 0, cost: 0 }, tmpDir, exportPath);
    expect(existsSync(exportPath)).toBe(true);
  });

  it("produces valid markdown with correct headers", () => {
    buildExportContent([], "claude-opus-4-5", { tokensIn: 100, tokensOut: 200, cost: 0.05 }, "/projects/myapp", exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("# AutoAgent Conversation Export");
    expect(content).toContain("**Model**: claude-opus-4-5");
    expect(content).toContain("**Project**: myapp");
    expect(content).toContain("**Date**:");
  });

  it("includes token and cost summary section", () => {
    buildExportContent([], "claude-3-5-sonnet-20241022", { tokensIn: 1500, tokensOut: 800, cost: 0.0123 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("## Session Summary");
    expect(content).toContain("**Tokens in**: 1,500");
    expect(content).toContain("**Tokens out**: 800");
    expect(content).toContain("**Total cost**: 0.01");
  });

  it("formats high cost with 2 decimal places", () => {
    buildExportContent([], "claude-3-5-sonnet-20241022", { tokensIn: 0, tokensOut: 0, cost: 1.5678 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("**Total cost**: 1.57");
  });

  it("includes user messages", () => {
    const messages = [{ role: "user" as const, content: "Hello, fix my bug" }];
    buildExportContent(messages, "claude-3-5-sonnet-20241022", { tokensIn: 10, tokensOut: 20, cost: 0.001 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("## User");
    expect(content).toContain("Hello, fix my bug");
  });

  it("includes assistant text messages", () => {
    const messages = [{ role: "assistant" as const, content: "I fixed the bug for you." }];
    buildExportContent(messages, "claude-3-5-sonnet-20241022", { tokensIn: 10, tokensOut: 20, cost: 0.001 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("## Assistant");
    expect(content).toContain("I fixed the bug for you.");
  });

  it("strips tool-call JSON lines from assistant messages", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: 'Let me run that.\n{"type":"tool_use","id":"toolu_01","name":"bash","input":{"command":"ls"}}\nDone.',
      },
    ];
    buildExportContent(messages, "claude-3-5-sonnet-20241022", { tokensIn: 10, tokensOut: 20, cost: 0.001 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("Let me run that.");
    expect(content).toContain("Done.");
    expect(content).not.toContain('{"type":"tool_use"');
  });

  it("skips assistant messages that are purely tool calls", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: '{"type":"tool_use","id":"toolu_01","name":"bash","input":{"command":"ls"}}',
      },
    ];
    buildExportContent(messages, "claude-3-5-sonnet-20241022", { tokensIn: 10, tokensOut: 20, cost: 0.001 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).not.toContain("## Assistant");
  });

  it("handles empty messages array — produces valid markdown", () => {
    buildExportContent([], "claude-3-5-sonnet-20241022", { tokensIn: 0, tokensOut: 0, cost: 0 }, tmpDir, exportPath);
    const content = readFileSync(exportPath, "utf-8");
    expect(content).toContain("# AutoAgent Conversation Export");
    expect(content).toContain("## Session Summary");
    expect(content.length).toBeGreaterThan(50);
  });
});
