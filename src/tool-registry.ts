/**
 * Tool Registry — maps tool names to definitions and handlers.
 *
 * This decouples tool dispatch from agent.ts, reducing complexity
 * and making it trivial to add new tools (just register them).
 */

import type Anthropic from "@anthropic-ai/sdk";
import { bashToolDefinition } from "./tools/bash.js";
import { readFileToolDefinition } from "./tools/read_file.js";
import { writeFileToolDefinition } from "./tools/write_file.js";
import { grepToolDefinition } from "./tools/grep.js";
import { webFetchToolDefinition } from "./tools/web_fetch.js";
import { thinkToolDefinition } from "./tools/think.js";
import { listFilesToolDefinition } from "./tools/list_files.js";
import { subagentToolDefinition } from "./tools/subagent.js";
import { webSearchToolDefinition } from "./tools/web_search.js";
import { autoSelectModel } from "./model-selection.js";
import { saveToProjectMemory } from "./project-memory.js";
import {
  saveScratchpadToolDefinition,
  readScratchpadToolDefinition,
} from "./tools/scratchpad.js";

// ─── Lazy executor loader ────────────────────────────────────

/**
 * Defers import of a tool executor module until first invocation.
 * Keeps definition/schema imports eager (needed for API) while
 * deferring heavy executor imports for faster startup.
 */
function lazyExecutor(modulePath: string, exportName: string): (...args: unknown[]) => Promise<unknown> {
  let cached: ((...args: unknown[]) => unknown) | null = null;
  return async (...args: unknown[]) => {
    if (!cached) {
      const mod = await import(modulePath);
      cached = mod[exportName] as (...args: unknown[]) => unknown;
    }
    return cached!(...args);
  };
}

import { CodeSearchIndex } from "./semantic-search.js";
import * as fs from "fs";
import { glob } from "glob";

// ─── Semantic search index (shared across registry instances) ─

/** Lazily populated BM25 index — rebuilt by buildSearchIndex() */
export const codeSearchIndex = new CodeSearchIndex();
let indexBuilt = false;

/**
 * (Re)build the BM25 code search index from .ts/.js/.md files in rootDir.
 * Safe to call multiple times — clears old state each time.
 */
export async function buildSearchIndex(rootDir: string): Promise<number> {
  // Reset index by creating a fresh instance reference isn't possible since it's const,
  // so we track a separate fresh index and replace the contents.
  const freshIndex = new CodeSearchIndex();
  const patterns = ["**/*.ts", "**/*.js", "**/*.md"];
  const ignore = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/*.d.ts"];
  const files: string[] = [];
  for (const pattern of patterns) {
    const found = await glob(pattern, { cwd: rootDir, ignore, absolute: true });
    files.push(...found);
  }
  const unique = [...new Set(files)];
  for (const file of unique) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      freshIndex.addFile(file, content);
    } catch {
      // skip unreadable files
    }
  }
  // Copy fresh index data into the shared instance by rebuilding from scratch
  // We re-export via a mutable holder so orchestrator can swap it
  _searchIndexHolder.index = freshIndex;
  indexBuilt = true;
  return freshIndex.fileCount;
}

/** Mutable holder so orchestrator and TUI can share the latest index */
export const _searchIndexHolder: { index: CodeSearchIndex } = { index: codeSearchIndex };

// ─── Types ──────────────────────────────────────────────────

export interface ToolContext {
  rootDir: string;
  log: (msg: string) => void;
  /** Default timeout for this tool (from registry), in seconds */
  defaultTimeout?: number;
  /** Callback to accumulate sub-agent token usage into session totals */
  addTokens?: (tokensIn: number, tokensOut: number) => void;
}

export interface ToolResult {
  result: string;
  isRestart?: boolean;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

export interface ToolOptions {
  /** Default timeout in seconds for this tool (used when caller doesn't specify) */
  defaultTimeout?: number;
}

export interface RegisteredTool {
  definition: Anthropic.Tool;
  handler: ToolHandler;
  defaultTimeout?: number;
}

// ─── Registry ───────────────────────────────────────────────

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(definition: Anthropic.Tool, handler: ToolHandler, options?: ToolOptions): void {
    this.tools.set(definition.name, {
      definition,
      handler,
      defaultTimeout: options?.defaultTimeout,
    });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** Get the default timeout for a tool, or undefined if not set */
  getTimeout(name: string): number | undefined {
    return this.tools.get(name)?.defaultTimeout;
  }

  getDefinitions(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }
}

// ─── Default Registry ───────────────────────────────────────

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // ── bash ──────────────────────────────────────────────
  const lazyExecuteBash = lazyExecutor("./tools/bash.js", "executeBash");
  registry.register(bashToolDefinition, async (input, ctx) => {
    const { command, timeout } = input as { command: string; timeout?: number };
    ctx.log(`$ ${command.slice(0, 200)}${command.length > 200 ? "..." : ""}`);

    if (command.includes("AUTOAGENT_RESTART")) {
      ctx.log("RESTART signal");
      return {
        result: "RESTART acknowledged. Harness will validate, commit, restart.",
        isRestart: true,
      };
    }

    const effectiveTimeout = timeout || ctx.defaultTimeout || 120;
    const r = await lazyExecuteBash(command, effectiveTimeout, ctx.rootDir) as { exitCode: number; output: string };
    ctx.log(`  -> exit=${r.exitCode} (${r.output.length} chars)`);
    return { result: r.output };
  }, { defaultTimeout: 120 });

  // ── read_file ─────────────────────────────────────────
  const lazyExecuteReadFile = lazyExecutor("./tools/read_file.js", "executeReadFile");
  registry.register(readFileToolDefinition, async (input, ctx) => {
    const { path: filePath, start_line, end_line } = input as {
      path: string; start_line?: number; end_line?: number;
    };
    ctx.log(`read_file: ${filePath}`);
    const r = await lazyExecuteReadFile(filePath, start_line, end_line, ctx.rootDir) as { success: boolean; content: string };
    ctx.log(`  -> ${r.success ? "ok" : "err"} (${r.content.length} chars)`);
    return { result: r.content };
  }, { defaultTimeout: 10 });

  // ── write_file ────────────────────────────────────────
  const lazyExecuteWriteFile = lazyExecutor("./tools/write_file.js", "executeWriteFile");
  registry.register(writeFileToolDefinition, async (input, ctx) => {
    const {
      path: filePath, content, mode, old_string, new_string,
    } = input as {
      path: string; content?: string; mode?: "write" | "append" | "patch";
      old_string?: string; new_string?: string;
    };
    const m = mode || "write";
    ctx.log(`write_file: ${filePath} (${m})`);
    const r = await lazyExecuteWriteFile(filePath, content || "", m, ctx.rootDir, old_string, new_string) as { success: boolean; message: string };
    ctx.log(`  -> ${r.success ? "ok" : "err"}: ${r.message}`);
    return { result: r.message };
  }, { defaultTimeout: 10 });

  // ── grep ──────────────────────────────────────────────
  const lazyExecuteGrep = lazyExecutor("./tools/grep.js", "executeGrep");
  registry.register(grepToolDefinition, async (input, ctx) => {
    const {
      pattern, path: searchPath, glob: globPattern, type, output_mode,
      context, case_insensitive, max_results, multiline,
    } = input as {
      pattern: string; path?: string; glob?: string; type?: string;
      output_mode?: "content" | "files" | "count"; context?: number;
      case_insensitive?: boolean; max_results?: number; multiline?: boolean;
    };
    ctx.log(`grep: "${pattern}"${searchPath ? ` in ${searchPath}` : ""}`);
    const r = await lazyExecuteGrep(
      pattern, searchPath, globPattern, type, output_mode,
      context, case_insensitive, max_results, multiline, ctx.rootDir,
    ) as { matchCount: number; content: string };
    ctx.log(`  -> ${r.matchCount} matches`);
    return { result: r.content };
  }, { defaultTimeout: 30 });

  // ── web_fetch ─────────────────────────────────────────
  const lazyExecuteWebFetch = lazyExecutor("./tools/web_fetch.js", "executeWebFetch");
  registry.register(webFetchToolDefinition, async (input, ctx) => {
    const { url, extract_text, headers } = input as {
      url: string; extract_text?: boolean; headers?: Record<string, string>;
    };
    ctx.log(`web_fetch: ${url}`);
    const r = await lazyExecuteWebFetch(url, extract_text, headers) as { success: boolean; content: string };
    ctx.log(`  -> ${r.success ? "ok" : "err"} (${r.content.length} chars)`);
    return { result: r.content };
  }, { defaultTimeout: 30 });

  // ── think ─────────────────────────────────────────────
  registry.register(thinkToolDefinition, async (input, ctx) => {
    const { thought } = input as { thought: string };
    ctx.log(`think: ${thought.slice(0, 120)}...`);
    return { result: `Thought recorded (${thought.length} chars). Continue.` };
  }, { defaultTimeout: 5 });

  // ── list_files ────────────────────────────────────────
  const lazyExecuteListFiles = lazyExecutor("./tools/list_files.js", "executeListFiles");
  registry.register(listFilesToolDefinition, async (input, ctx) => {
    const { path: dirPath, depth, exclude } = input as {
      path?: string; depth?: number; exclude?: string[];
    };
    ctx.log(`list_files: ${dirPath || "."} (depth=${depth || 3})`);
    const r = await lazyExecuteListFiles(dirPath, depth, exclude, ctx.rootDir) as { success: boolean; dirCount: number; fileCount: number; content: string };
    ctx.log(`  -> ${r.success ? "ok" : "err"} (${r.dirCount} dirs, ${r.fileCount} files)`);
    return { result: r.content };
  }, { defaultTimeout: 15 });

  // ── subagent ──────────────────────────────────────────
  const lazyExecuteSubagent = lazyExecutor("./tools/subagent.js", "executeSubagent");
  registry.register(subagentToolDefinition, async (input, ctx) => {
    const { task, model, max_tokens } = input as {
      task: string; model?: string; max_tokens?: number;
    };
    // If no model specified, use autoSelectModel to pick based on task description
    const selectedModel = model ?? autoSelectModel(task);
    ctx.log(`subagent [${selectedModel}${!model ? ' (auto)' : ''}]: ${task.slice(0, 100)}...`);
    const r = await lazyExecuteSubagent(task, selectedModel, max_tokens) as { model: string; inputTokens: number; outputTokens: number; response: string };
    ctx.log(`  -> ${r.model} (${r.inputTokens}in/${r.outputTokens}out)`);
    ctx.addTokens?.(r.inputTokens, r.outputTokens);
    return {
      result: `[Sub-agent: ${selectedModel}${!model ? ' (auto-selected)' : ''} | ${r.inputTokens}+${r.outputTokens} tokens]\n\n${r.response}`,
    };
  }, { defaultTimeout: 60 });

  // ── web_search ───────────────────────────────────────
  const lazyExecuteWebSearch = lazyExecutor("./tools/web_search.js", "executeWebSearch");
  registry.register(webSearchToolDefinition, async (input, ctx) => {
    const { query, max_results } = input as { query: string; max_results?: number };
    ctx.log(`web_search: "${query}"`);
    const r = await lazyExecuteWebSearch(query, max_results) as { results: unknown[]; content: string };
    ctx.log(`  -> ${r.results.length} results`);
    return { result: r.content };
  }, { defaultTimeout: 15 });

  // ── save_memory ──────────────────────────────────────
  registry.register(
    {
      name: "save_memory",
      description:
        "Persist a piece of project knowledge to the project memory file (.autoagent.md). " +
        "Use this when the user asks you to remember something, or when you discover important " +
        "project facts (conventions, architecture decisions, recurring patterns) that should be " +
        "recalled in future sessions.",
      input_schema: {
        type: "object" as const,
        properties: {
          key: {
            type: "string",
            description: "Short label for this memory entry (e.g. 'preferred test runner', 'API base URL')",
          },
          value: {
            type: "string",
            description: "The content to remember.",
          },
        },
        required: ["key", "value"],
      },
    },
    async (input, ctx) => {
      const { key, value } = input as { key: string; value: string };
      ctx.log(`save_memory: "${key}"`);
      const note = `**${key}**: ${value}`;
      const filePath = saveToProjectMemory(ctx.rootDir, note);
      ctx.log(`  -> saved to ${filePath}`);
      return { result: `Saved to project memory (${filePath}): ${key}` };
    },
    { defaultTimeout: 5 },
  );

  // ── save_scratchpad ──────────────────────────────────
  const lazyExecuteSaveScratchpad = lazyExecutor("./tools/scratchpad.js", "executeSaveScratchpad");
  registry.register(saveScratchpadToolDefinition, async (input, ctx) => {
    const { note } = input as { note: string };
    const result = await lazyExecuteSaveScratchpad(note, ctx.rootDir) as string;
    ctx.log(`save_scratchpad: ${note.slice(0, 60)}`);
    return { result };
  }, { defaultTimeout: 5 });

  // ── read_scratchpad ──────────────────────────────────
  const lazyExecuteReadScratchpad = lazyExecutor("./tools/scratchpad.js", "executeReadScratchpad");
  registry.register(readScratchpadToolDefinition, async (_input, ctx) => {
    const result = await lazyExecuteReadScratchpad(ctx.rootDir) as string;
    ctx.log(`read_scratchpad: ${result.length} chars`);
    return { result };
  }, { defaultTimeout: 5 });

  // ── semantic_search ───────────────────────────────────
  registry.register(
    {
      name: "semantic_search",
      description:
        "BM25 full-text code search over the project's .ts/.js/.md files. " +
        "Returns ranked chunks with file path, line range, score, and snippet. " +
        "Use this to find relevant code by concept (e.g. 'error handling', 'token counting') " +
        "when you don't know the exact symbol or file name.",
      input_schema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Natural language or code concept to search for",
          },
          max_results: {
            type: "number",
            description: "Maximum results to return (default: 5)",
          },
        },
        required: ["query"],
      },
    },
    async (input, ctx) => {
      const { query, max_results } = input as { query: string; max_results?: number };
      const maxR = max_results ?? 5;
      ctx.log(`semantic_search: "${query}" (max=${maxR})`);
      // Auto-build index on first use
      if (_searchIndexHolder.index.fileCount === 0) {
        ctx.log(`  building index...`);
        await buildSearchIndex(ctx.rootDir);
      }
      const results = _searchIndexHolder.index.search(query, maxR);
      if (results.length === 0) {
        return { result: "No results found." };
      }
      const lines = results.map((r, i) =>
        `${i + 1}. ${r.file}:${r.lineStart}-${r.lineEnd} (score=${r.score.toFixed(2)})\n   ${r.snippet.replace(/\n/g, " ").slice(0, 120)}`
      );
      ctx.log(`  -> ${results.length} results`);
      return { result: lines.join("\n\n") };
    },
    { defaultTimeout: 30 },
  );

  return registry;
}
