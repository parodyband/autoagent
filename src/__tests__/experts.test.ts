import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import os from "os";
import {
  parseExpertFile,
  loadExperts,
  pickExpert,
  buildExpertPrompt,
  loadExpertState,
  saveExpertState,
} from "../experts.js";
import type { Expert } from "../experts.js";
import type { IterationState } from "../iteration.js";

// ─── parseExpertFile ──────────────────────────────────────────

describe("parseExpertFile", () => {
  it("parses a valid expert file with name and model", () => {
    const content = `---\nname: Specialist\nmodel: claude-sonnet-4-6\n---\nYou are a specialist.`;
    const expert = parseExpertFile(content);
    expect(expert).not.toBeNull();
    expect(expert!.name).toBe("Specialist");
    expect(expert!.model).toBe("claude-sonnet-4-6");
    expect(expert!.prompt).toBe("You are a specialist.");
  });

  it("uses default model when model is omitted", () => {
    const content = `---\nname: NakedExpert\n---\nPrompt text here.`;
    const expert = parseExpertFile(content);
    expect(expert).not.toBeNull();
    expect(expert!.model).toBe("claude-sonnet-4-6");
  });

  it("returns null when frontmatter is missing", () => {
    const content = `No frontmatter here, just plain text.`;
    expect(parseExpertFile(content)).toBeNull();
  });

  it("returns null when name is missing from frontmatter", () => {
    const content = `---\nmodel: claude-opus-4-6\n---\nPrompt here.`;
    expect(parseExpertFile(content)).toBeNull();
  });

  it("returns null when prompt body is empty", () => {
    const content = `---\nname: Empty\nmodel: claude-sonnet-4-6\n---\n`;
    expect(parseExpertFile(content)).toBeNull();
  });

  it("trims whitespace from name and model", () => {
    const content = `---\nname:   Trimmed Name   \nmodel:   claude-opus-4-6   \n---\nSome prompt.`;
    const expert = parseExpertFile(content);
    expect(expert!.name).toBe("Trimmed Name");
    expect(expert!.model).toBe("claude-opus-4-6");
  });

  it("preserves multiline prompt content", () => {
    const content = `---\nname: Multi\nmodel: claude-sonnet-4-6\n---\nLine one.\nLine two.\nLine three.`;
    const expert = parseExpertFile(content);
    expect(expert!.prompt).toContain("Line one.");
    expect(expert!.prompt).toContain("Line three.");
  });
});

// ─── loadExperts ──────────────────────────────────────────────

describe("loadExperts", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "experts-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 4 builtin experts when no .experts/ directory exists", () => {
    const experts = loadExperts(tmpDir);
    expect(experts).toHaveLength(4);
  });

  it("builtin rotation is Engineer, Architect, Engineer, Meta", () => {
    const experts = loadExperts(tmpDir);
    expect(experts[0].name).toBe("Engineer");
    expect(experts[1].name).toBe("Architect");
    expect(experts[2].name).toBe("Engineer");
    expect(experts[3].name).toBe("Meta");
  });

  it("loads custom expert from .experts/ directory", () => {
    const expertDir = path.join(tmpDir, ".experts");
    mkdirSync(expertDir);
    writeFileSync(
      path.join(expertDir, "specialist.md"),
      `---\nname: Specialist\nmodel: claude-sonnet-4-6\n---\nYou are a specialist.`
    );
    const experts = loadExperts(tmpDir);
    expect(experts).toHaveLength(5);
    const specialist = experts.find(e => e.name === "Specialist");
    expect(specialist).toBeDefined();
    expect(specialist!.prompt).toBe("You are a specialist.");
  });

  it("skips malformed .experts/ files gracefully", () => {
    const expertDir = path.join(tmpDir, ".experts");
    mkdirSync(expertDir);
    writeFileSync(path.join(expertDir, "bad.md"), `no frontmatter here`);
    const experts = loadExperts(tmpDir);
    // Should still have 4 builtins, bad file is skipped
    expect(experts).toHaveLength(4);
  });

  it("only reads .md files from .experts/ directory", () => {
    const expertDir = path.join(tmpDir, ".experts");
    mkdirSync(expertDir);
    writeFileSync(path.join(expertDir, "valid.md"), `---\nname: Valid\n---\nPrompt.`);
    writeFileSync(path.join(expertDir, "ignored.txt"), `---\nname: Ignored\n---\nPrompt.`);
    const experts = loadExperts(tmpDir);
    expect(experts).toHaveLength(5);
    expect(experts.find(e => e.name === "Ignored")).toBeUndefined();
  });
});

// ─── pickExpert ───────────────────────────────────────────────

describe("pickExpert", () => {
  const experts: Expert[] = [
    { name: "Engineer", model: "claude-sonnet-4-6", prompt: "E" },
    { name: "Architect", model: "claude-opus-4-6", prompt: "A" },
    { name: "Engineer", model: "claude-sonnet-4-6", prompt: "E2" },
    { name: "Meta", model: "claude-opus-4-6", prompt: "M" },
  ];

  it("iteration 0 → first expert (Engineer)", () => {
    expect(pickExpert(0, experts).name).toBe("Engineer");
  });

  it("iteration 1 → Architect", () => {
    expect(pickExpert(1, experts).name).toBe("Architect");
  });

  it("iteration 2 → Engineer (second slot)", () => {
    expect(pickExpert(2, experts).name).toBe("Engineer");
  });

  it("iteration 3 → Meta", () => {
    expect(pickExpert(3, experts).name).toBe("Meta");
  });

  it("iteration 4 wraps back to Engineer", () => {
    expect(pickExpert(4, experts).name).toBe("Engineer");
  });

  it("returns fallback Engineer for empty experts list", () => {
    const result = pickExpert(0, []);
    expect(result.name).toBe("Engineer");
  });
});

// ─── buildExpertPrompt ────────────────────────────────────────

describe("buildExpertPrompt", () => {
  const expert: Expert = {
    name: "TestExpert",
    model: "claude-sonnet-4-6",
    prompt: "Root: {{ROOT}}, Iter: {{ITERATION}}, Last: {{LAST_SUCCESSFUL}}, Expert: {{EXPERT}}",
  };

  const state: IterationState = {
    iteration: 42,
    lastSuccessfulIteration: 41,
  };

  it("substitutes {{ROOT}}", () => {
    const result = buildExpertPrompt(expert, state, "/my/project");
    expect(result).toContain("Root: /my/project");
  });

  it("substitutes {{ITERATION}}", () => {
    const result = buildExpertPrompt(expert, state, "/my/project");
    expect(result).toContain("Iter: 42");
  });

  it("substitutes {{LAST_SUCCESSFUL}}", () => {
    const result = buildExpertPrompt(expert, state, "/my/project");
    expect(result).toContain("Last: 41");
  });

  it("substitutes {{EXPERT}}", () => {
    const result = buildExpertPrompt(expert, state, "/my/project");
    expect(result).toContain("Expert: TestExpert");
  });

  it("replaces all occurrences of a placeholder", () => {
    const multi: Expert = {
      name: "X",
      model: "m",
      prompt: "{{ROOT}} and {{ROOT}} again",
    };
    const result = buildExpertPrompt(multi, state, "/root");
    expect(result).toBe("/root and /root again");
  });
});

// ─── saveExpertState / loadExpertState ────────────────────────

describe("saveExpertState / loadExpertState", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "expert-state-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loadExpertState returns empty state when file does not exist", () => {
    const state = loadExpertState(tmpDir);
    expect(state.lastExpert).toBe("");
    expect(state.history).toEqual([]);
  });

  it("saveExpertState persists lastExpert and history entry", () => {
    saveExpertState(tmpDir, "Engineer", 5);
    const state = loadExpertState(tmpDir);
    expect(state.lastExpert).toBe("Engineer");
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual({ iteration: 5, expert: "Engineer" });
  });

  it("accumulates multiple history entries", () => {
    saveExpertState(tmpDir, "Engineer", 1);
    saveExpertState(tmpDir, "Architect", 2);
    saveExpertState(tmpDir, "Engineer", 3);
    const state = loadExpertState(tmpDir);
    expect(state.history).toHaveLength(3);
    expect(state.lastExpert).toBe("Engineer");
  });

  it("trims history to 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveExpertState(tmpDir, "Engineer", i);
    }
    const state = loadExpertState(tmpDir);
    expect(state.history).toHaveLength(20);
    // Should have the last 20 (iterations 5-24)
    expect(state.history[0].iteration).toBe(5);
    expect(state.history[19].iteration).toBe(24);
  });
});
