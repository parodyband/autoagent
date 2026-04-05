/**
 * Tool Registry — maps tool names to definitions and handlers.
 *
 * This decouples tool dispatch from agent.ts, reducing complexity
 * and making it trivial to add new tools (just register them).
 */

import type Anthropic from "@anthropic-ai/sdk";
import { bashToolDefinition, executeBash } from "./tools/bash.js";
import { readFileToolDefinition, executeReadFile } from "./tools/read_file.js";
import { writeFileToolDefinition, executeWriteFile } from "./tools/write_file.js";
import { grepToolDefinition, executeGrep } from "./tools/grep.js";
import { webFetchToolDefinition, executeWebFetch } from "./tools/web_fetch.js";
import { thinkToolDefinition, executeThink } from "./tools/think.js";
import { listFilesToolDefinition, executeListFiles } from "./tools/list_files.js";
import { subagentToolDefinition, executeSubagent } from "./tools/subagent.js";
import { webSearchToolDefinition, executeWebSearch } from "./tools/web_search.js";
import { autoSelectModel } from "./model-selection.js";
import { saveToProjectMemory } from "./project-memory.js";

// ─── Types ──────────────────────────────────────────────────

export interface ToolContext {
  rootDir: string;
  log: (msg: string) => void;
  /** Default timeout for this tool (from registry), in seconds */
  defaultTimeout?: number;
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
    const r = await executeBash(command, effectiveTimeout, ctx.rootDir);
    ctx.log(`  -> exit=${r.exitCode} (${r.output.length} chars)`);
    return { result: r.output };
  }, { defaultTimeout: 120 });

  // ── read_file ─────────────────────────────────────────
  registry.register(readFileToolDefinition, async (input, ctx) => {
    const { path: filePath, start_line, end_line } = input as {
      path: string; start_line?: number; end_line?: number;
    };
    ctx.log(`read_file: ${filePath}`);
    const r = executeReadFile(filePath, start_line, end_line, ctx.rootDir);
    ctx.log(`  -> ${r.success ? "ok" : "err"} (${r.content.length} chars)`);
    return { result: r.content };
  }, { defaultTimeout: 10 });

  // ── write_file ────────────────────────────────────────
  registry.register(writeFileToolDefinition, async (input, ctx) => {
    const {
      path: filePath, content, mode, old_string, new_string,
    } = input as {
      path: string; content?: string; mode?: "write" | "append" | "patch";
      old_string?: string; new_string?: string;
    };
    const m = mode || "write";
    ctx.log(`write_file: ${filePath} (${m})`);
    const r = executeWriteFile(filePath, content || "", m, ctx.rootDir, old_string, new_string);
    ctx.log(`  -> ${r.success ? "ok" : "err"}: ${r.message}`);
    return { result: r.message };
  }, { defaultTimeout: 10 });

  // ── grep ──────────────────────────────────────────────
  registry.register(grepToolDefinition, async (input, ctx) => {
    const {
      pattern, path: searchPath, glob, type, output_mode,
      context, case_insensitive, max_results, multiline,
    } = input as {
      pattern: string; path?: string; glob?: string; type?: string;
      output_mode?: "content" | "files" | "count"; context?: number;
      case_insensitive?: boolean; max_results?: number; multiline?: boolean;
    };
    ctx.log(`grep: "${pattern}"${searchPath ? ` in ${searchPath}` : ""}`);
    const r = executeGrep(
      pattern, searchPath, glob, type, output_mode,
      context, case_insensitive, max_results, multiline, ctx.rootDir,
    );
    ctx.log(`  -> ${r.matchCount} matches`);
    return { result: r.content };
  }, { defaultTimeout: 30 });

  // ── web_fetch ─────────────────────────────────────────
  registry.register(webFetchToolDefinition, async (input, ctx) => {
    const { url, extract_text, headers } = input as {
      url: string; extract_text?: boolean; headers?: Record<string, string>;
    };
    ctx.log(`web_fetch: ${url}`);
    const r = await executeWebFetch(url, extract_text, headers);
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
  registry.register(listFilesToolDefinition, async (input, ctx) => {
    const { path: dirPath, depth, exclude } = input as {
      path?: string; depth?: number; exclude?: string[];
    };
    ctx.log(`list_files: ${dirPath || "."} (depth=${depth || 3})`);
    const r = executeListFiles(dirPath, depth, exclude, ctx.rootDir);
    ctx.log(`  -> ${r.success ? "ok" : "err"} (${r.dirCount} dirs, ${r.fileCount} files)`);
    return { result: r.content };
  }, { defaultTimeout: 15 });

  // ── subagent ──────────────────────────────────────────
  registry.register(subagentToolDefinition, async (input, ctx) => {
    const { task, model, max_tokens } = input as {
      task: string; model?: string; max_tokens?: number;
    };
    // If no model specified, use autoSelectModel to pick based on task description
    const selectedModel = model ?? autoSelectModel(task);
    ctx.log(`subagent [${selectedModel}${!model ? ' (auto)' : ''}]: ${task.slice(0, 100)}...`);
    const r = await executeSubagent(task, selectedModel, max_tokens);
    ctx.log(`  -> ${r.model} (${r.inputTokens}in/${r.outputTokens}out)`);
    return {
      result: `[Sub-agent: ${selectedModel}${!model ? ' (auto-selected)' : ''} | ${r.inputTokens}+${r.outputTokens} tokens]\n\n${r.response}`,
    };
  }, { defaultTimeout: 60 });

  // ── web_search ───────────────────────────────────────
  registry.register(webSearchToolDefinition, async (input, ctx) => {
    const { query, max_results } = input as { query: string; max_results?: number };
    ctx.log(`web_search: "${query}"`);
    const r = await executeWebSearch(query, max_results);
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

  return registry;
}
