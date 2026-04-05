import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { globalFileCache } from "../file-cache.js";

export const readFileToolDefinition: Anthropic.Tool = {
  name: "read_file",
  description:
    "Read the contents of a file. More efficient than bash for simple file reads. " +
    "Returns the file contents or an error message. Supports optional line range.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "Path to the file (relative to project root or absolute).",
      },
      start_line: {
        type: "integer",
        description: "Optional: first line to read (1-indexed). Omit to read from start.",
      },
      end_line: {
        type: "integer",
        description: "Optional: last line to read (1-indexed, inclusive). Omit to read to end.",
      },
    },
    required: ["path"],
  },
};

export interface ReadFileResult {
  content: string;
  success: boolean;
}

export function executeReadFile(
  filePath: string,
  startLine?: number,
  endLine?: number,
  cwd?: string
): ReadFileResult {
  const workDir = cwd ?? process.cwd();
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workDir, filePath);

  try {
    if (!existsSync(resolvedPath)) {
      return { content: `ERROR: File not found: ${resolvedPath}`, success: false };
    }

    const stats = statSync(resolvedPath);
    if (stats.isDirectory()) {
      return { content: `ERROR: Path is a directory: ${resolvedPath}`, success: false };
    }

    // Warn if file is very large (> 1MB)
    if (stats.size > 1_000_000) {
      return {
        content: `WARNING: File is ${(stats.size / 1_000_000).toFixed(1)}MB. Use bash with head/tail for large files.`,
        success: false,
      };
    }

    // Check cache first (only for full-file reads, not line ranges)
    if (startLine === undefined && endLine === undefined) {
      const cached = globalFileCache.get(resolvedPath);
      if (cached) {
        return { content: cached.content + "\n[cached — file unchanged since last read]", success: true };
      }
    }

    const content = readFileSync(resolvedPath, "utf-8");

    // Store in cache for full-file reads
    if (startLine === undefined && endLine === undefined) {
      globalFileCache.put(resolvedPath, content);
    }

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split("\n");
      const start = (startLine ?? 1) - 1; // convert to 0-indexed
      const end = endLine ?? lines.length;
      const slice = lines.slice(Math.max(0, start), end);
      return { content: slice.join("\n"), success: true };
    }

    return { content, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `ERROR: ${msg}`, success: false };
  }
}
