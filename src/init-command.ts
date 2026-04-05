/**
 * /init command — analyzes the current repo and generates/updates .autoagent.md
 * with project-specific context: build commands, architecture, conventions, entry points.
 */

import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { detectProject, type ProjectSummary } from "./project-detector.js";
import { buildRepoMap, formatRepoMap, rankSymbols } from "./tree-sitter-map.js";

const AUTOAGENT_MD = ".autoagent.md";
const HAIKU_MODEL = "claude-haiku-4-5";

/** Read package.json scripts for build/test/run commands */
function readPackageScripts(workDir: string): Record<string, string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(workDir, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

/** Get a compact file listing for context (top-level + src/) */
function getFileListing(workDir: string): string {
  const lines: string[] = [];
  try {
    const entries = fs.readdirSync(workDir);
    for (const e of entries.slice(0, 30)) {
      if (e.startsWith(".") || e === "node_modules" || e === "dist") continue;
      lines.push(e);
    }
  } catch { /* ignore */ }
  try {
    const srcEntries = fs.readdirSync(path.join(workDir, "src"));
    for (const e of srcEntries.slice(0, 20)) {
      lines.push(`src/${e}`);
    }
  } catch { /* ignore */ }
  return lines.join("\n");
}

/** Build a repo map string (truncated) for context */
function buildRepoMapContext(workDir: string): string {
  try {
    const { execSync } = require("child_process") as typeof import("child_process");
    const out = execSync(`git -C ${JSON.stringify(workDir)} ls-files`, { encoding: "utf-8" }) as string;
    const files = out.split("\n").filter((f: string) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".py") || f.endsWith(".rs") || f.endsWith(".go"));
    if (files.length === 0) return "";
    const repoMap = buildRepoMap(workDir, files.slice(0, 80));
    const ranked = rankSymbols(repoMap);
    return formatRepoMap(repoMap, { ranked });
  } catch {
    return "";
  }
}

function formatProjectInfo(info: ProjectSummary): string {
  const lines: string[] = [];
  lines.push(`- Type: ${info.type} (${info.language})`);
  if (info.framework) lines.push(`- Framework: ${info.framework}`);
  if (info.packageManager) lines.push(`- Package manager: ${info.packageManager}`);
  if (info.testRunner) lines.push(`- Test runner: ${info.testRunner}`);
  if (info.entryPoints?.length) lines.push(`- Entry points: ${info.entryPoints.join(", ")}`);
  if (info.workspaces?.length) lines.push(`- Workspaces: ${info.workspaces.join(", ")}`);
  return lines.join("\n");
}

/** Generate a .autoagent.md for the given project using Haiku */
async function generateAutoagentMd(
  workDir: string,
  info: ProjectSummary,
  existingContent: string | null,
  repoMapContext: string,
  scripts: Record<string, string>,
  fileListing: string,
): Promise<string> {
  const client = new Anthropic();

  const scriptsBlock =
    Object.keys(scripts).length > 0
      ? Object.entries(scripts)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n")
      : "(none detected)";

  const existingSection = existingContent
    ? `\n\n## Existing .autoagent.md content (preserve user-added sections):\n${existingContent.slice(0, 2000)}`
    : "";

  const prompt = `You are generating a .autoagent.md file for an AI coding assistant. This file provides project-specific context to help the AI work more effectively.

## Project info:
${formatProjectInfo(info)}

## Package scripts:
${scriptsBlock}

## File listing:
${fileListing}

## Repo map (key symbols):
${repoMapContext || "(not available)"}
${existingSection}

Generate a concise .autoagent.md with these sections:
1. **Project** — 1-2 sentence description of what this project is
2. **Commands** — key commands to build, run, test, lint (use exact scripts from package.json if available)
3. **Architecture** — brief description of code structure (2-5 bullet points, based on file listing and repo map)
4. **Conventions** — coding conventions specific to this project (language, framework conventions)
5. **Key Files** — most important files/entry points

Rules:
- Be concise and specific — no generic advice
- Use actual file paths and command names from the project
- If there's an existing .autoagent.md, preserve any user-added content that doesn't conflict
- Output ONLY the markdown content, no preamble`;

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from model");
  }
  return textBlock.text.trim();
}

/**
 * Run the /init command: analyze the project and generate/update .autoagent.md.
 * Returns the generated content for display.
 */
export async function runInit(
  workDir: string,
  onStatus?: (msg: string) => void,
): Promise<{ content: string; updated: boolean }> {
  onStatus?.("Detecting project type...");
  const info = detectProject(workDir);

  const autoagentMdPath = path.join(workDir, AUTOAGENT_MD);
  let existingContent: string | null = null;
  let updated = false;

  try {
    existingContent = fs.readFileSync(autoagentMdPath, "utf-8");
    updated = true;
  } catch { /* file doesn't exist */ }

  onStatus?.("Analyzing repository structure...");
  const repoMapContext = buildRepoMapContext(workDir);
  const scripts = readPackageScripts(workDir);
  const fileListing = getFileListing(workDir);

  onStatus?.("Generating .autoagent.md with AI...");
  const content = await generateAutoagentMd(
    workDir,
    info,
    existingContent,
    repoMapContext,
    scripts,
    fileListing,
  );

  onStatus?.("Writing .autoagent.md...");
  fs.writeFileSync(autoagentMdPath, content, "utf-8");

  return { content, updated };
}
