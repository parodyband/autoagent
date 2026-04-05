import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import os from "os";
import {
  findProjectRoot,
  loadProjectMemory,
  formatProjectMemory,
  getProjectMemoryBlock,
  saveToProjectMemory,
  saveToLocalMemory,
} from "../src/project-memory.js";

// ─── Test helpers ──────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(os.tmpdir(), `pm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// ─── findProjectRoot ───────────────────────────────────────────

describe("findProjectRoot", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => cleanup(tmp));

  it("returns startDir when no marker found", () => {
    const sub = join(tmp, "a", "b");
    mkdirSync(sub, { recursive: true });
    const result = findProjectRoot(sub);
    expect(result).toBe(sub);
  });

  it("finds .git at root", () => {
    mkdirSync(join(tmp, ".git"));
    const sub = join(tmp, "src", "deep");
    mkdirSync(sub, { recursive: true });
    const result = findProjectRoot(sub);
    expect(result).toBe(tmp);
  });

  it("finds package.json at root", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    const sub = join(tmp, "lib");
    mkdirSync(sub);
    const result = findProjectRoot(sub);
    expect(result).toBe(tmp);
  });

  it("finds CLAUDE.md at root", () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "# instructions");
    const sub = join(tmp, "nested");
    mkdirSync(sub);
    expect(findProjectRoot(sub)).toBe(tmp);
  });

  it("stops at nearest root marker", () => {
    // outer has .git, inner has package.json — should stop at inner
    mkdirSync(join(tmp, ".git"));
    const inner = join(tmp, "inner");
    mkdirSync(inner);
    writeFileSync(join(inner, "package.json"), "{}");
    const sub = join(inner, "src");
    mkdirSync(sub);
    expect(findProjectRoot(sub)).toBe(inner);
  });
});

// ─── loadProjectMemory ─────────────────────────────────────────

describe("loadProjectMemory", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => cleanup(tmp));

  it("returns empty array when no files exist", () => {
    const entries = loadProjectMemory(tmp);
    // May include global ~/.autoagent/memory.md if it exists — filter to just project files
    const local = entries.filter(e => e.path.startsWith(tmp));
    expect(local).toHaveLength(0);
  });

  it("loads CLAUDE.md", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    writeFileSync(join(tmp, "CLAUDE.md"), "Always use TypeScript.");
    const entries = loadProjectMemory(tmp);
    const found = entries.find(e => e.label === "CLAUDE.md");
    expect(found).toBeDefined();
    expect(found!.content).toContain("Always use TypeScript.");
  });

  it("loads .autoagent.md", () => {
    writeFileSync(join(tmp, ".autoagent.md"), "Use vitest for tests.");
    const entries = loadProjectMemory(tmp);
    const found = entries.find(e => e.label === ".autoagent.md");
    expect(found).toBeDefined();
    expect(found!.content).toContain("vitest");
  });

  it("loads .cursorrules", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    writeFileSync(join(tmp, ".cursorrules"), "Prefer functional style.");
    const entries = loadProjectMemory(tmp);
    const found = entries.find(e => e.label === ".cursorrules");
    expect(found).toBeDefined();
    expect(found!.content).toContain("functional");
  });

  it("loads local memory file", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    mkdirSync(join(tmp, ".autoagent"));
    writeFileSync(join(tmp, ".autoagent", "local.md"), "My local note.");
    const entries = loadProjectMemory(tmp);
    const found = entries.find(e => e.label === "Local memory");
    expect(found).toBeDefined();
    expect(found!.content).toContain("local note");
  });

  it("ignores empty files", () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "   ");
    const entries = loadProjectMemory(tmp);
    const found = entries.find(e => e.label === "CLAUDE.md");
    expect(found).toBeUndefined();
  });
});

// ─── formatProjectMemory ───────────────────────────────────────

describe("formatProjectMemory", () => {
  it("returns empty string for no entries", () => {
    expect(formatProjectMemory([])).toBe("");
  });

  it("includes section header and content", () => {
    const result = formatProjectMemory([
      { path: "/foo/CLAUDE.md", label: "CLAUDE.md", content: "Use TS." },
    ]);
    expect(result).toContain("## Project Memory");
    expect(result).toContain("CLAUDE.md");
    expect(result).toContain("Use TS.");
  });

  it("separates multiple entries", () => {
    const result = formatProjectMemory([
      { path: "/foo/CLAUDE.md", label: "CLAUDE.md", content: "Rule 1" },
      { path: "/foo/.autoagent.md", label: ".autoagent.md", content: "Rule 2" },
    ]);
    expect(result).toContain("Rule 1");
    expect(result).toContain("Rule 2");
  });
});

// ─── getProjectMemoryBlock ─────────────────────────────────────

describe("getProjectMemoryBlock", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => cleanup(tmp));

  it("returns empty string when no memory files", () => {
    const result = getProjectMemoryBlock(tmp);
    // May be non-empty if global ~/.autoagent/memory.md exists — just check type
    expect(typeof result).toBe("string");
  });

  it("returns formatted block when CLAUDE.md present", () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "Always lint.");
    const result = getProjectMemoryBlock(tmp);
    expect(result).toContain("Project Memory");
    expect(result).toContain("Always lint.");
  });
});

// ─── saveToProjectMemory ───────────────────────────────────────

describe("saveToProjectMemory", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => cleanup(tmp));

  it("creates .autoagent.md if absent", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    const filePath = saveToProjectMemory(tmp, "Remember this note.");
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("Remember this note.");
  });

  it("appends to existing .autoagent.md", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    writeFileSync(join(tmp, ".autoagent.md"), "# Existing\nOld content.");
    saveToProjectMemory(tmp, "New note.");
    const content = readFileSync(join(tmp, ".autoagent.md"), "utf8");
    expect(content).toContain("Old content.");
    expect(content).toContain("New note.");
  });

  it("includes date timestamp", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    saveToProjectMemory(tmp, "Dated note.");
    const content = readFileSync(join(tmp, ".autoagent.md"), "utf8");
    const today = new Date().toISOString().split("T")[0];
    expect(content).toContain(today);
  });
});

// ─── saveToLocalMemory ─────────────────────────────────────────

describe("saveToLocalMemory", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => cleanup(tmp));

  it("creates .autoagent/local.md and directory", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    const filePath = saveToLocalMemory(tmp, "Local secret.");
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("Local secret.");
  });

  it("appends to existing local.md", () => {
    writeFileSync(join(tmp, "package.json"), "{}");
    mkdirSync(join(tmp, ".autoagent"));
    writeFileSync(join(tmp, ".autoagent", "local.md"), "# Local\nFirst note.");
    saveToLocalMemory(tmp, "Second note.");
    const content = readFileSync(join(tmp, ".autoagent", "local.md"), "utf8");
    expect(content).toContain("First note.");
    expect(content).toContain("Second note.");
  });
});
