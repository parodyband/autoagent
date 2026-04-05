/**
 * Tests confirming that detectProject().summary is injected into
 * the orchestrator's system prompt after init().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock detectProject ───────────────────────────────────────
const MOCK_SUMMARY = "This is a TypeScript monorepo with a React frontend.";

vi.mock("../project-detector.js", () => ({
  detectProject: vi.fn().mockReturnValue({
    type: "app",
    language: "TypeScript",
    framework: "React",
    packageManager: "npm",
    testRunner: "vitest",
    entryPoints: ["src/index.tsx"],
    workspaces: [],
    summary: MOCK_SUMMARY,
  }),
}));

// Mock all heavy dependencies so we don't need a real repo or API
vi.mock("../repo-context.js", () => ({
  fingerprintRepo: vi.fn().mockReturnValue("mock-fingerprint"),
}));

vi.mock("../file-ranker.js", () => ({
  rankFiles: vi.fn().mockReturnValue([]),
}));

vi.mock("../tree-sitter-map.js", () => ({
  buildRepoMap: vi.fn().mockReturnValue({}),
  formatRepoMap: vi.fn().mockReturnValue(""),
  rankSymbols: vi.fn().mockReturnValue([]),
  truncateRepoMap: vi.fn().mockReturnValue(""),
}));

vi.mock("../project-memory.js", () => ({
  getProjectMemoryBlock: vi.fn().mockReturnValue(""),
}));

vi.mock("../session-store.js", () => ({
  initSession: vi.fn().mockReturnValue("/tmp/test-session.jsonl"),
  saveMessage: vi.fn(),
  loadSession: vi.fn().mockReturnValue([]),
  cleanOldSessions: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock("../file-watcher.js", () => ({
  FileWatcher: vi.fn().mockImplementation(() => ({
    watch: vi.fn(),
    unwatch: vi.fn(),
    onChange: null,
  })),
}));

describe("Orchestrator system prompt — project summary injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects detectProject().summary into system prompt after init()", async () => {
    const { Orchestrator } = await import("../orchestrator.js");
    const orch = new Orchestrator({ workDir: "/tmp/test-project" });
    await orch.init();

    // Access private systemPrompt via type cast
    const systemPrompt = (orch as unknown as { systemPrompt: string }).systemPrompt;
    expect(systemPrompt).toContain(MOCK_SUMMARY);
  });

  it("includes '## Project Context' section header in system prompt", async () => {
    const { Orchestrator } = await import("../orchestrator.js");
    const orch = new Orchestrator({ workDir: "/tmp/test-project" });
    await orch.init();

    const systemPrompt = (orch as unknown as { systemPrompt: string }).systemPrompt;
    expect(systemPrompt).toContain("## Project Context");
  });

  it("does not duplicate project summary on repeated init() calls", async () => {
    const { Orchestrator } = await import("../orchestrator.js");
    const orch = new Orchestrator({ workDir: "/tmp/test-project" });
    await orch.init();
    await orch.init(); // second call should be no-op (guard: if initialized return)

    const systemPrompt = (orch as unknown as { systemPrompt: string }).systemPrompt;
    const count = (systemPrompt.split(MOCK_SUMMARY) ?? []).length - 1;
    expect(count).toBe(1);
  });
});
