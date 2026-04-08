import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { discoverSkills, loadSkill, getSkillsMenu } from "../skills.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function mkSkillsDir(): string {
  const dir = path.join(tmpDir, ".autoagent", "skills");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSkill(dir: string, filename: string, content: string) {
  fs.writeFileSync(path.join(dir, filename), content, "utf8");
}

// ─── discoverSkills ──────────────────────────────────────────

describe("discoverSkills", () => {
  it("returns empty array when skills dir does not exist", () => {
    expect(discoverSkills(tmpDir)).toEqual([]);
  });

  it("returns empty array when skills dir is empty", () => {
    mkSkillsDir();
    expect(discoverSkills(tmpDir)).toEqual([]);
  });

  it("ignores non-.md files", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "notes.txt", "some text");
    expect(discoverSkills(tmpDir)).toHaveLength(0);
  });

  it("discovers a single skill with name + description", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "refactoring.md", "Refactoring\nGuide for safe code refactoring.\n\nBody here.");
    const skills = discoverSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Refactoring");
    expect(skills[0].description).toBe("Guide for safe code refactoring.");
    expect(skills[0].path).toContain("refactoring.md");
  });

  it("strips leading # from heading lines", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "testing.md", "# Testing Best Practices\n## When to write tests\n\nBody.");
    const skills = discoverSkills(tmpDir);
    expect(skills[0].name).toBe("Testing Best Practices");
    expect(skills[0].description).toBe("When to write tests");
  });

  it("uses filename as name when first line is empty", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "my-skill.md", "\nsome description");
    const skills = discoverSkills(tmpDir);
    expect(skills[0].name).toBe("my-skill");
  });

  it("uses (no description) when second line is empty", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "skill.md", "My Skill\n\nBody.");
    const skills = discoverSkills(tmpDir);
    expect(skills[0].description).toBe("(no description)");
  });

  it("discovers multiple skills sorted by name", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "z-skill.md", "Z Skill\nDesc Z");
    writeSkill(dir, "a-skill.md", "A Skill\nDesc A");
    writeSkill(dir, "m-skill.md", "M Skill\nDesc M");
    const skills = discoverSkills(tmpDir);
    expect(skills).toHaveLength(3);
    expect(skills[0].name).toBe("A Skill");
    expect(skills[1].name).toBe("M Skill");
    expect(skills[2].name).toBe("Z Skill");
  });
});

// ─── loadSkill ───────────────────────────────────────────────

describe("loadSkill", () => {
  it("throws when skill not found", () => {
    mkSkillsDir();
    expect(() => loadSkill(tmpDir, "nonexistent")).toThrow(/not found/);
  });

  it("returns full file content", () => {
    const dir = mkSkillsDir();
    const content = "My Skill\nShort description\n\nThis is the body with **details**.";
    writeSkill(dir, "my-skill.md", content);
    const skills = discoverSkills(tmpDir);
    const result = loadSkill(tmpDir, skills[0].name);
    expect(result).toBe(content);
  });

  it("error message lists available skills", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "alpha.md", "Alpha\nAlpha description");
    expect(() => loadSkill(tmpDir, "beta")).toThrow(/Alpha/);
  });
});

// ─── getSkillsMenu ───────────────────────────────────────────

describe("getSkillsMenu", () => {
  it("returns empty string when no skills directory", () => {
    expect(getSkillsMenu(tmpDir)).toBe("");
  });

  it("returns empty string when skills directory is empty", () => {
    mkSkillsDir();
    expect(getSkillsMenu(tmpDir)).toBe("");
  });

  it("includes skill names and descriptions", () => {
    const dir = mkSkillsDir();
    writeSkill(dir, "refactoring.md", "Refactoring\nSafe refactoring guide");
    writeSkill(dir, "testing.md", "Testing\nHow to write tests");
    const menu = getSkillsMenu(tmpDir);
    expect(menu).toContain("## Available Skills");
    expect(menu).toContain("**Refactoring**");
    expect(menu).toContain("Safe refactoring guide");
    expect(menu).toContain("**Testing**");
    expect(menu).toContain("load_skill");
  });
});
