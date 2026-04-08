/**
 * Skills system — lazy-loaded context snippets.
 *
 * Users place .md files in .autoagent/skills/. Each file's first line is the
 * skill name (heading or plain text), second line is a short description.
 * The full content is only loaded when the LLM explicitly requests it,
 * keeping the default system prompt lean (just a menu of available skills).
 */

import * as fs from "fs";
import * as path from "path";

export interface Skill {
  /** Slug derived from filename (without .md) */
  name: string;
  /** Short description from line 2 of the file */
  description: string;
  /** Absolute path to the .md file */
  path: string;
}

/** Directory within the project root where skill files live */
const SKILLS_DIR = ".autoagent/skills";

/**
 * Scan the skills directory and return metadata for every .md file found.
 * Returns an empty array when the directory doesn't exist.
 */
export function discoverSkills(projectRoot: string): Skill[] {
  const dir = path.join(projectRoot, SKILLS_DIR);
  if (!fs.existsSync(dir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const skills: Skill[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(dir, entry);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    // First non-empty line → name (strip leading #/spaces)
    const nameLine = (lines[0] ?? "").replace(/^#+\s*/, "").trim();
    // Second non-empty line → description
    const descLine = (lines[1] ?? "").replace(/^#+\s*/, "").trim();

    const name = nameLine || path.basename(entry, ".md");
    const description = descLine || "(no description)";

    skills.push({ name, description, path: filePath });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load the full content of a named skill.
 * `skillName` must match the `name` field returned by `discoverSkills`.
 * Throws if the skill is not found.
 */
export function loadSkill(projectRoot: string, skillName: string): string {
  const skills = discoverSkills(projectRoot);
  const skill = skills.find((s) => s.name === skillName);
  if (!skill) {
    throw new Error(
      `Skill "${skillName}" not found. Available: ${skills.map((s) => s.name).join(", ") || "none"}`
    );
  }
  return fs.readFileSync(skill.path, "utf8");
}

/**
 * Build a formatted markdown menu of available skills for system prompt injection.
 * Returns an empty string when no skills are available.
 */
export function getSkillsMenu(projectRoot: string): string {
  const skills = discoverSkills(projectRoot);
  if (skills.length === 0) return "";

  const lines = [
    "## Available Skills",
    "",
    "You may load any of the following skills by name to get detailed guidance:",
    "",
  ];
  for (const skill of skills) {
    lines.push(`- **${skill.name}**: ${skill.description}`);
  }
  lines.push(
    "",
    'To load a skill, use the `load_skill` tool with `{"name": "<skill-name>"}` before proceeding.'
  );
  return lines.join("\n");
}
