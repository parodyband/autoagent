/**
 * Tests for src/init-command.ts — runInit()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock Anthropic to avoid real API calls
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "# Generated .autoagent.md\n\nTest content." }],
        }),
      },
    })),
  };
});

// Mock tree-sitter-map to avoid parsing overhead
vi.mock("../tree-sitter-map.js", () => ({
  buildRepoMap: vi.fn().mockReturnValue({}),
  formatRepoMap: vi.fn().mockReturnValue(""),
  rankSymbols: vi.fn().mockReturnValue([]),
  truncateRepoMap: vi.fn().mockReturnValue(""),
}));

// Mock project-detector
vi.mock("../project-detector.js", () => ({
  detectProject: vi.fn().mockReturnValue({
    type: "library",
    language: "TypeScript",
    framework: "Node.js",
    packageManager: "npm",
    testRunner: "vitest",
    entryPoints: ["src/index.ts"],
    workspaces: [],
    summary: "A TypeScript library project.",
  }),
}));

// Mock child_process to avoid git calls
vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

const TEST_DIR = path.join(process.cwd(), ".self-test-tmp", "init-command-test");

describe("runInit", () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates .autoagent.md when none exists", async () => {
    const { runInit } = await import("../init-command.js");
    const result = await runInit(TEST_DIR);

    const autoagentPath = path.join(TEST_DIR, ".autoagent.md");
    expect(fs.existsSync(autoagentPath)).toBe(true);
    expect(result.content).toBeTruthy();
    expect(result.updated).toBe(false); // new file, not updated
  });

  it("sets updated=true when .autoagent.md already exists", async () => {
    // Pre-create the file
    fs.writeFileSync(path.join(TEST_DIR, ".autoagent.md"), "# Existing content\n", "utf-8");

    const { runInit } = await import("../init-command.js");
    const result = await runInit(TEST_DIR);

    expect(result.updated).toBe(true);
  });

  it("calls onStatus callbacks during execution", async () => {
    const { runInit } = await import("../init-command.js");
    const statuses: string[] = [];
    await runInit(TEST_DIR, (msg) => statuses.push(msg));

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.some((s) => s.toLowerCase().includes("detect"))).toBe(true);
  });

  it("writes the AI-generated content to .autoagent.md", async () => {
    const { runInit } = await import("../init-command.js");
    const result = await runInit(TEST_DIR);

    const written = fs.readFileSync(path.join(TEST_DIR, ".autoagent.md"), "utf-8");
    expect(written).toBe(result.content);
    expect(written).toContain("Generated .autoagent.md");
  });

  it("uses detectProject to determine project type", async () => {
    const { detectProject } = await import("../project-detector.js");
    const { runInit } = await import("../init-command.js");

    await runInit(TEST_DIR);

    expect(detectProject).toHaveBeenCalledWith(TEST_DIR);
  });

  it("returns content string from AI response", async () => {
    const { runInit } = await import("../init-command.js");
    const result = await runInit(TEST_DIR);

    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });
});
