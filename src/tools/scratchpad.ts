/**
 * Scratchpad tools — ephemeral per-session working notes.
 * save_scratchpad appends a timestamped note to .autoagent-scratchpad.md
 * read_scratchpad reads back the current scratchpad contents.
 * The scratchpad is cleared at session start by the orchestrator.
 */

import fs from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";

export const saveScratchpadToolDefinition: Anthropic.Tool = {
  name: "save_scratchpad",
  description:
    "Append a note to the session scratchpad (.autoagent-scratchpad.md). " +
    "Use this to record your plan, progress, and key findings during complex tasks. " +
    "Read it back after context compaction to recover working state.",
  input_schema: {
    type: "object" as const,
    properties: {
      note: {
        type: "string",
        description: "The note to append to the scratchpad.",
      },
    },
    required: ["note"],
  },
};

export const readScratchpadToolDefinition: Anthropic.Tool = {
  name: "read_scratchpad",
  description:
    "Read the current session scratchpad (.autoagent-scratchpad.md). " +
    "Returns '(empty)' if no notes have been saved yet.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function executeSaveScratchpad(note: string, workDir: string): string {
  const filePath = path.join(workDir, ".autoagent-scratchpad.md");
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n\n${note}\n`;
  fs.appendFileSync(filePath, entry, "utf8");
  return `Note saved to scratchpad.`;
}

export function executeReadScratchpad(workDir: string): string {
  const filePath = path.join(workDir, ".autoagent-scratchpad.md");
  if (!fs.existsSync(filePath)) return "(empty)";
  const contents = fs.readFileSync(filePath, "utf8").trim();
  return contents.length > 0 ? contents : "(empty)";
}

export function clearScratchpad(workDir: string): void {
  const filePath = path.join(workDir, ".autoagent-scratchpad.md");
  fs.writeFileSync(filePath, "", "utf8");
}
