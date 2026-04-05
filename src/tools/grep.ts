/**
 * Grep tool — search file contents with regex, powered by ripgrep.
 * Falls back to native grep if rg is not installed.
 */

import { execSync } from "child_process";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";

export const grepToolDefinition: Anthropic.Tool = {
  name: "grep",
  description:
    "Search file contents using regex patterns (powered by ripgrep). " +
    "Use this to find functions, variables, imports, strings, or any text pattern across files. " +
    "Supports regex, glob filters, file type filters, context lines, and multiple output modes. " +
    "Much faster and more capable than bash grep.",
  input_schema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for.",
      },
      path: {
        type: "string",
        description: "File or directory to search in (relative to project root or absolute). Default: project root.",
      },
      glob: {
        type: "string",
        description: "Glob pattern to filter files (e.g. '*.ts', '*.{ts,tsx}').",
      },
      type: {
        type: "string",
        description: "File type filter (e.g. 'ts', 'py', 'md'). Uses ripgrep's --type.",
      },
      output_mode: {
        type: "string",
        enum: ["content", "files", "count"],
        description: "'content' = matching lines with context (default). 'files' = just file paths. 'count' = match counts per file.",
      },
      context: {
        type: "integer",
        description: "Lines of context before and after each match (like grep -C). Default: 0.",
      },
      case_insensitive: {
        type: "boolean",
        description: "Case insensitive search. Default: false.",
      },
      max_results: {
        type: "integer",
        description: "Maximum results to return. Default: 100.",
      },
      multiline: {
        type: "boolean",
        description: "Enable multiline matching (pattern can span lines). Default: false.",
      },
    },
    required: ["pattern"],
  },
};

export interface GrepResult {
  content: string;
  success: boolean;
  matchCount: number;
}

function hasRipgrep(): boolean {
  try {
    execSync("rg --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function executeGrep(
  pattern: string,
  searchPath?: string,
  glob?: string,
  fileType?: string,
  outputMode: "content" | "files" | "count" = "content",
  context: number = 0,
  caseInsensitive: boolean = false,
  maxResults: number = 100,
  multiline: boolean = false,
  cwd?: string
): GrepResult {
  const workDir = cwd ?? process.cwd();
  const resolvedPath = searchPath
    ? path.isAbsolute(searchPath) ? searchPath : path.join(workDir, searchPath)
    : workDir;

  const useRg = hasRipgrep();

  try {
    const args: string[] = [];

    if (useRg) {
      args.push("rg");
      if (outputMode === "files") args.push("--files-with-matches");
      else if (outputMode === "count") args.push("--count");
      else args.push("--line-number", "--no-heading");
      if (context > 0 && outputMode === "content") args.push("-C", `${context}`);
      if (caseInsensitive) args.push("-i");
      if (multiline) args.push("-U", "--multiline-dotall");
      args.push("--color=never");
      if (glob) args.push("--glob", glob);
      if (fileType) args.push("--type", fileType);
      args.push("--max-count", `${maxResults}`);
      args.push("--glob", "!node_modules", "--glob", "!.git", "--glob", "!dist", "--glob", "!package-lock.json");
      args.push("--", pattern, resolvedPath);
    } else {
      args.push("grep", "-rn", "--color=never");
      if (caseInsensitive) args.push("-i");
      if (context > 0) args.push(`-C${context}`);
      if (outputMode === "files") args.push("-l");
      if (outputMode === "count") args.push("-c");
      if (glob) args.push(`--include=${glob}`);
      args.push("--exclude-dir=node_modules", "--exclude-dir=.git", "--exclude-dir=dist");
      const escaped = pattern.replace(/'/g, "'\\''");
      args.push(`'${escaped}'`, resolvedPath);
    }

    const cmd = args.join(" ");
    const output = execSync(cmd, { cwd: workDir, encoding: "utf-8", maxBuffer: 2 * 1024 * 1024, timeout: 30000 });
    const lines = output.trim().split("\n").filter(Boolean);
    const relativized = lines.map((line) => line.startsWith(workDir + "/") ? line.slice(workDir.length + 1) : line);
    const limited = relativized.slice(0, maxResults);
    const truncated = relativized.length > maxResults;
    let result = limited.join("\n");
    if (truncated) result += `\n\n... (${relativized.length - maxResults} more results truncated)`;
    return { content: result || "No matches found.", success: true, matchCount: limited.length };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 1) {
      return { content: "No matches found.", success: true, matchCount: 0 };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `ERROR: ${msg}`, success: false, matchCount: 0 };
  }
}
