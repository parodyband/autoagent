/**
 * List files tool — recursively list directory contents with tree output.
 * Provides a fast way to understand project structure without bash.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { readdirSync, statSync } from "fs";
import path from "path";

export const listFilesToolDefinition: Anthropic.Tool = {
  name: "list_files",
  description:
    "List directory contents recursively with a tree-like output showing file sizes. " +
    "Excludes node_modules, .git, and dist by default. " +
    "Useful for quickly understanding project structure without running bash commands.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "Directory path to list (relative to project root). Default: '.'",
      },
      depth: {
        type: "integer",
        description: "Maximum depth to recurse. Default: 3. Use 1 for shallow listing.",
      },
      exclude: {
        type: "array",
        items: { type: "string" },
        description:
          "Directory/file names to exclude. Default: ['node_modules', '.git', 'dist', '.self-test-tmp']",
      },
    },
    required: [],
  },
};

const DEFAULT_EXCLUDE = ["node_modules", ".git", "dist", ".self-test-tmp"];
const DEFAULT_DEPTH = 3;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

interface ListFilesResult {
  content: string;
  success: boolean;
  fileCount: number;
  dirCount: number;
}

function walkDir(
  dirPath: string,
  prefix: string,
  currentDepth: number,
  maxDepth: number,
  exclude: string[],
  lines: string[],
  counters: { files: number; dirs: number }
): void {
  let entries: { name: string; isDir: boolean; size: number }[];
  try {
    const names = readdirSync(dirPath);
    entries = names
      .filter((name) => !exclude.includes(name))
      .map((name) => {
        const fullPath = path.join(dirPath, name);
        try {
          const st = statSync(fullPath);
          return { name, isDir: st.isDirectory(), size: st.size };
        } catch {
          return { name, isDir: false, size: 0 };
        }
      })
      .sort((a, b) => {
        // Dirs first, then alphabetical
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch (err) {
    lines.push(`${prefix}[error reading directory]`);
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");

    if (entry.isDir) {
      counters.dirs++;
      if (currentDepth < maxDepth) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        walkDir(
          path.join(dirPath, entry.name),
          childPrefix,
          currentDepth + 1,
          maxDepth,
          exclude,
          lines,
          counters
        );
      } else {
        lines.push(`${prefix}${connector}${entry.name}/ [...]`);
      }
    } else {
      counters.files++;
      lines.push(`${prefix}${connector}${entry.name} (${formatSize(entry.size)})`);
    }
  }
}

export function executeListFiles(
  dirPath: string = ".",
  depth: number = DEFAULT_DEPTH,
  exclude: string[] = DEFAULT_EXCLUDE,
  rootDir?: string
): ListFilesResult {
  const resolvedPath = rootDir
    ? path.resolve(rootDir, dirPath)
    : path.resolve(dirPath);

  // Security: prevent traversal outside project root
  const effectiveRoot = rootDir || process.cwd();
  if (!resolvedPath.startsWith(effectiveRoot)) {
    return {
      content: `ERROR: Path "${dirPath}" resolves outside project root.`,
      success: false,
      fileCount: 0,
      dirCount: 0,
    };
  }

  try {
    const st = statSync(resolvedPath);
    if (!st.isDirectory()) {
      return {
        content: `ERROR: "${dirPath}" is not a directory.`,
        success: false,
        fileCount: 0,
        dirCount: 0,
      };
    }
  } catch {
    return {
      content: `ERROR: Directory "${dirPath}" not found.`,
      success: false,
      fileCount: 0,
      dirCount: 0,
    };
  }

  const lines: string[] = [`${dirPath}/`];
  const counters = { files: 0, dirs: 0 };

  walkDir(resolvedPath, "", 1, depth, exclude, lines, counters);

  lines.push("");
  lines.push(`${counters.dirs} directories, ${counters.files} files`);

  return {
    content: lines.join("\n"),
    success: true,
    fileCount: counters.files,
    dirCount: counters.dirs,
  };
}
