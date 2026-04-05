import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock Anthropic before importing init-command
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: "# Project\nA Node.js TypeScript project.\n\n# Commands\n- `npm test` — run tests\n- `npm run build` — build\n\n# Architecture\n- `src/` — source files\n- `tests/` — test files\n\n# Conventions\n- ESM, TypeScript strict\n\n# Key Files\n- `src/index.ts` — entry point",
            },
          ],
        }),
      },
    })),
  };
});

// Mock child_process to avoid real git calls
vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue("src/index.ts\nsrc/cli.ts\n"),
}));

// Import after mocks
import { runInit } from "../src/init-command.js";

describe("runInit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "init-test-"));
    // Create a minimal package.json so detectProject finds something
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        scripts: {
          test: "vitest",
          build: "tsc",
        },
      })
    );
    // Create a src directory
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/index.ts"), 'export const hello = "world";');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("generates .autoagent.md content for a Node project", async () => {
    const statusMessages: string[] = [];
    const result = await runInit(tmpDir, (msg) => statusMessages.push(msg));

    expect(result.content).toBeTruthy();
    expect(result.content.length).toBeGreaterThan(10);
    // Should write the file
    const written = fs.readFileSync(path.join(tmpDir, ".autoagent.md"), "utf-8");
    expect(written).toBe(result.content);
    // Should have called status callbacks
    expect(statusMessages.length).toBeGreaterThan(0);
  });

  it("returns updated=false when .autoagent.md did not previously exist", async () => {
    const result = await runInit(tmpDir);
    expect(result.updated).toBe(false);
  });

  it("returns updated=true when .autoagent.md already exists", async () => {
    // Create existing .autoagent.md
    fs.writeFileSync(
      path.join(tmpDir, ".autoagent.md"),
      "# Existing content\nUser-written notes here."
    );

    const result = await runInit(tmpDir);
    expect(result.updated).toBe(true);
  });

  it("handles missing git gracefully (no crash)", async () => {
    // Override execSync to throw (simulating no git)
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error("git not found");
    });

    // Should not throw
    await expect(runInit(tmpDir)).resolves.toBeDefined();
  });

  it("writes the returned content to .autoagent.md", async () => {
    const result = await runInit(tmpDir);
    const onDisk = fs.readFileSync(path.join(tmpDir, ".autoagent.md"), "utf-8");
    expect(onDisk).toBe(result.content);
  });
});
