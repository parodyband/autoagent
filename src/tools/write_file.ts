/**
 * Write file tool — create or overwrite files, with mkdir -p and diff reporting.
 */

import { writeFileSync, readFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";

export const writeFileToolDefinition: Anthropic.Tool = {
  name: "write_file",
  description:
    "Write content to a file. Creates parent directories automatically. " +
    "Use mode 'write' to create/overwrite, 'append' to add to end, " +
    "or 'patch' to apply a simple find-and-replace edit. " +
    "Safer and more reliable than bash heredocs for writing files.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "Path to the file (relative to project root or absolute).",
      },
      content: {
        type: "string",
        description: "For write/append mode: the content. For patch mode: not used.",
      },
      mode: {
        type: "string",
        enum: ["write", "append", "patch"],
        description: "Write mode. Default: 'write'.",
      },
      old_string: {
        type: "string",
        description: "For 'patch' mode: the exact string to find and replace.",
      },
      new_string: {
        type: "string",
        description: "For 'patch' mode: the replacement string.",
      },
    },
    required: ["path"],
  },
};

export interface WriteFileResult {
  message: string;
  success: boolean;
}

function countLines(s: string): number {
  if (!s) return 0;
  return s.split("\n").length;
}

export function executeWriteFile(
  filePath: string,
  content: string = "",
  mode: "write" | "append" | "patch" = "write",
  cwd?: string,
  oldString?: string,
  newString?: string
): WriteFileResult {
  const workDir = cwd ?? process.cwd();
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(workDir, filePath);

  try {
    const dir = path.dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const existed = existsSync(resolved);
    let oldContent = "";
    if (existed) {
      try { oldContent = readFileSync(resolved, "utf-8"); } catch {}
    }

    if (mode === "patch") {
      if (!oldString) return { message: "ERROR: patch mode requires old_string", success: false };
      if (!existed) return { message: `ERROR: Cannot patch non-existent file: ${filePath}`, success: false };
      if (!oldContent.includes(oldString)) {
        return { message: `ERROR: old_string not found in ${filePath}. Must match exactly.`, success: false };
      }
      const patched = oldContent.replace(oldString, newString ?? "");
      writeFileSync(resolved, patched, "utf-8");
      return { message: `Patched ${filePath}: -${countLines(oldString)} +${countLines(newString ?? "")} lines`, success: true };
    }

    if (mode === "append") {
      appendFileSync(resolved, content, "utf-8");
      return { message: `Appended ${content.length} chars to ${filePath}`, success: true };
    }

    writeFileSync(resolved, content, "utf-8");
    if (!existed) return { message: `Created ${filePath} (${content.length} chars)`, success: true };
    const diff = countLines(content) - countLines(oldContent);
    return { message: `Updated ${filePath} (${content.length} chars, ${diff > 0 ? "+" : ""}${diff} lines delta)`, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { message: `ERROR: ${msg}`, success: false };
  }
}
