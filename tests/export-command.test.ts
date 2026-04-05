import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Helpers that mirror the TUI's export logic ─────────────────────────────
// We extract the export logic into a testable helper so we can unit-test it
// without spinning up the full Ink TUI.

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FooterStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
}

/**
 * Mirrors the /export implementation in tui.tsx.
 */
function buildExportContent(
  messages: Message[],
  stats: FooterStats,
  projectName: string,
  now: Date,
): string {
  const model = stats.model;
  const { tokensIn, tokensOut, cost } = stats;

  const lines: string[] = [
    `# AutoAgent Conversation Export`,
    ``,
    `**Date**: ${now.toLocaleString()}`,
    `**Model**: ${model}`,
    `**Project**: ${projectName}`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`## User`, ``, msg.content, ``);
    } else {
      const textContent = msg.content
        .split("\n")
        .filter(l => !l.startsWith('{"type":"tool'))
        .join("\n")
        .trim();
      if (textContent) {
        lines.push(`## Assistant`, ``, textContent, ``);
      }
    }
  }

  lines.push(
    `---`,
    ``,
    `## Session Summary`,
    ``,
    `- **Tokens in**: ${tokensIn.toLocaleString()}`,
    `- **Tokens out**: ${tokensOut.toLocaleString()}`,
    `- **Total cost**: $${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`,
    ``,
  );

  return lines.join("\n");
}

function makeFilename(now: Date): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `session-export-${timestamp}.md`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("/export command logic", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("basic export: produces valid markdown with header and messages", () => {
    const now = new Date("2024-01-15T10:30:00Z");
    const messages: Message[] = [
      { role: "user", content: "Hello, help me with TypeScript" },
      { role: "assistant", content: "Sure! TypeScript is a typed superset of JavaScript." },
    ];
    const stats: FooterStats = { tokensIn: 100, tokensOut: 200, cost: 0.005, model: "claude-sonnet-4" };

    const content = buildExportContent(messages, stats, "my-project", now);

    // Header checks
    expect(content).toContain("# AutoAgent Conversation Export");
    expect(content).toContain("**Model**: claude-sonnet-4");
    expect(content).toContain("**Project**: my-project");

    // Message content
    expect(content).toContain("## User");
    expect(content).toContain("Hello, help me with TypeScript");
    expect(content).toContain("## Assistant");
    expect(content).toContain("Sure! TypeScript is a typed superset of JavaScript.");

    // Summary section
    expect(content).toContain("## Session Summary");
    expect(content).toContain("**Tokens in**: 100");
    expect(content).toContain("**Tokens out**: 200");
    expect(content).toContain("**Total cost**: $0.0050");
  });

  it("empty conversation: produces header and summary but no message sections", () => {
    const now = new Date("2024-01-15T10:30:00Z");
    const messages: Message[] = [];
    const stats: FooterStats = { tokensIn: 0, tokensOut: 0, cost: 0, model: "claude-haiku-4" };

    const content = buildExportContent(messages, stats, "empty-project", now);

    expect(content).toContain("# AutoAgent Conversation Export");
    expect(content).toContain("**Project**: empty-project");
    expect(content).not.toContain("## User");
    expect(content).not.toContain("## Assistant");
    expect(content).toContain("## Session Summary");
    expect(content).toContain("**Tokens in**: 0");
    expect(content).toContain("**Total cost**: $0.0000");
  });

  it("filename format: session-export-<timestamp>.md", () => {
    const now = new Date("2024-06-15T14:22:33.456Z");
    const filename = makeFilename(now);

    expect(filename).toMatch(/^session-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/);
    expect(filename).toContain("session-export-");
    expect(filename.endsWith(".md")).toBe(true);
  });

  it("filename includes date components from the timestamp", () => {
    const now = new Date("2024-06-15T14:22:33.000Z");
    const filename = makeFilename(now);
    // Should contain the date part
    expect(filename).toContain("2024-06-15");
  });

  it("skips tool call lines in assistant messages", () => {
    const now = new Date();
    const messages: Message[] = [
      { role: "user", content: "Run a search" },
      {
        role: "assistant",
        content: 'Looking at the code...\n{"type":"tool_use","name":"bash"}\nHere is the result.',
      },
    ];
    const stats: FooterStats = { tokensIn: 50, tokensOut: 80, cost: 0.002, model: "claude-sonnet-4" };

    const content = buildExportContent(messages, stats, "proj", now);

    expect(content).toContain("Looking at the code...");
    expect(content).not.toContain('{"type":"tool_use"');
    expect(content).toContain("Here is the result.");
  });

  it("cost formatting: uses 2 decimal places for costs >= 0.01", () => {
    const now = new Date();
    const messages: Message[] = [];
    const stats: FooterStats = { tokensIn: 1000, tokensOut: 2000, cost: 1.2345, model: "claude-sonnet-4" };

    const content = buildExportContent(messages, stats, "proj", now);
    expect(content).toContain("**Total cost**: $1.23");
  });

  it("writes file to disk correctly", () => {
    const now = new Date("2024-01-15T10:30:00Z");
    const messages: Message[] = [
      { role: "user", content: "Test message" },
    ];
    const stats: FooterStats = { tokensIn: 10, tokensOut: 20, cost: 0.001, model: "claude-haiku-4" };
    const filename = makeFilename(now);
    const filePath = path.join(tmpDir, filename);

    const content = buildExportContent(messages, stats, "test-project", now);
    fs.writeFileSync(filePath, content, "utf-8");

    expect(fs.existsSync(filePath)).toBe(true);
    const readBack = fs.readFileSync(filePath, "utf-8");
    expect(readBack).toContain("Test message");
    expect(readBack).toContain("**Project**: test-project");
  });
});
