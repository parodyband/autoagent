/**
 * Coding Agent Orchestrator
 *
 * Sits between the TUI and the Claude API. Provides:
 *   - Repo context injection (fingerprintRepo)
 *   - Smart file ranking (rankFiles)
 *   - Task decomposition for complex requests (shouldDecompose / decomposeTasks)
 *   - Model routing (haiku for simple, sonnet for complex)
 *   - Self-verification after code changes (runVerification)
 *   - Streaming responses (onText called with deltas)
 *   - Token cost tracking (getCost())
 *   - Context compaction (summarize old messages at ~150K tokens)
 *   - Structured status callbacks for the UI
 */

import Anthropic from "@anthropic-ai/sdk";
import { compressToolOutput } from "./tool-output-compressor.js";
import { fingerprintRepo } from "./repo-context.js";
import { rankFiles } from "./file-ranker.js";
import { buildRepoMap, formatRepoMap, rankSymbols, truncateRepoMap, saveRepoMapCache, loadRepoMapCache, getStaleFiles, updateRepoMapIncremental, cacheToRepoMap } from "./tree-sitter-map.js";
import { shouldDecompose, decomposeTasks, formatSubtasks } from "./task-decomposer.js";
import { runVerification, formatVerificationResults } from "./verification.js";
import { createDefaultRegistry } from "./tool-registry.js";
import { getProjectMemoryBlock } from "./project-memory.js";
import {
  initSession,
  saveMessage,
  loadSession,
  cleanOldSessions,
} from "./session-store.js";
import {
  runArchitectMode,
  type EditPlan,
} from "./architect-mode.js";
import { autoCommit, type AutoCommitResult } from "./auto-commit.js";
import { runDiagnostics } from "./diagnostics.js";
import { findRelatedTests, runRelatedTests } from "./test-runner.js";
import { computeUnifiedDiff } from "./diff-preview.js";
import { autoLoadContext, extractFileReferences, loadFileReferences, stripFileReferences } from "./context-loader.js";
import { enhanceToolError } from "./tool-recovery.js";
import { detectProject } from "./project-detector.js";
import * as fs from "fs";
import { FileWatcher } from "./file-watcher.js";
import { scoredPrune } from "./context-pruner.js";

// ─── Constants ────────────────────────────────────────────────

/**
 * Tools that are safe to run in parallel — read-only, no side effects.
 * bash is excluded because it can have side effects.
 */
export const PARALLEL_SAFE_TOOLS = new Set([
  "read_file",
  "grep",
  "glob",
  "web_search",
  "web_fetch",
  "list_files",
]);

const MODEL_COMPLEX = "claude-sonnet-4-6";
const MODEL_SIMPLE = "claude-haiku-4-5";
const MAX_TOKENS = 16384;
const MAX_ROUNDS = 30;

/** Token threshold for micro-compaction: clear old tool result contents (~80K). */
export const MICRO_COMPACT_THRESHOLD = 80_000;
/** Token threshold for Tier 1 compaction: compress old tool outputs (~100K). */
export const COMPACT_TIER1_THRESHOLD = 100_000;
/** Token threshold for Tier 2 compaction: summarize old messages (~150K). */
export const COMPACT_THRESHOLD = 150_000;
/** Context warning threshold: warn user when input tokens reach 80% of T2 threshold. */
export const CONTEXT_WARNING_THRESHOLD = COMPACT_THRESHOLD * 0.8; // 120_000
export const PRUNE_THRESHOLD = 120_000; // Between Tier 1 (100K) and Tier 2 (150K)

/**
 * Pure function: select which compaction tier to apply based on input token count.
 * Used for mid-loop compaction decisions inside runAgentLoop.
 */
export function selectCompactionTier(inputTokens: number): 'none' | 'micro' | 'tier1' | 'tier2' {
  if (inputTokens >= COMPACT_THRESHOLD) return 'tier2';
  if (inputTokens >= COMPACT_TIER1_THRESHOLD) return 'tier1';
  if (inputTokens >= MICRO_COMPACT_THRESHOLD) return 'micro';
  return 'none';
}

/** Pricing per million tokens: [input, output] */
export const MODEL_PRICING: Record<string, [number, number]> = {
  [MODEL_COMPLEX]: [3.0, 15.0],
  [MODEL_SIMPLE]: [0.8, 4.0],
};

// Keywords that indicate code-changing intent (use sonnet)
const CODE_CHANGE_KEYWORDS = [
  "create", "write", "add", "implement", "build", "fix", "refactor",
  "update", "change", "modify", "delete", "remove", "rename",
  "install", "migrate", "convert",
];

// Keywords indicating read/explain intent (use haiku)
const READ_ONLY_KEYWORDS = [
  "explain", "what", "how", "why", "list", "show", "describe",
  "summarize", "find", "search", "look",
];

// ─── Types ───────────────────────────────────────────────────

// ─── Checkpoint types ─────────────────────────────────────────

/** A snapshot of the conversation at a point in time. */
export interface ConversationCheckpoint {
  id: number;
  label: string;
  messages: Anthropic.MessageParam[];
  timestamp: number;
}

/** Maximum number of checkpoints to retain in memory. */
export const MAX_CHECKPOINTS = 20;

export interface OrchestratorOptions {
  workDir: string;
  /** Called when a tool is invoked */
  onToolCall?: (name: string, input: string, result: string) => void;
  /** Called with status updates (e.g. "Indexing repo...") */
  onStatus?: (status: string) => void;
  /** Called with streaming text deltas */
  onText?: (delta: string) => void;
  /** If provided, resume an existing session instead of creating a new one */
  resumeSessionPath?: string;
  /** Called when an architect plan is generated */
  onPlan?: (plan: EditPlan) => void;
  /**
   * Called before write_file executes. Receives the unified diff and file path.
   * Return true to accept the write, false to reject it.
   * If not provided (or --no-confirm), writes proceed without confirmation.
   */
  onDiffPreview?: (diff: string, filePath: string) => Promise<boolean>;
  /**
   * Called when the context budget ratio changes (0.0–1.0).
   * TUI uses this to show a warning when approaching compaction threshold.
   */
  onContextBudget?: (ratio: number) => void;
  /**
   * Called once when lastInputTokens crosses 80% of the context window.
   * One-time notification per threshold crossing (resets on clearHistory).
   */
  onContextWarning?: () => void;
  /**
   * Called when one or more watched files are changed externally.
   * Receives the count of changed files since last send().
   */
  onExternalFileChange?: (paths: string[]) => void;
}

export interface OrchestratorResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  verificationPassed?: boolean;
  commitResult?: AutoCommitResult;
}

export interface CostInfo {
  cost: number;
  tokensIn: number;
  tokensOut: number;
  /** Token count of the most recent API call's input window (actual context size). */
  lastInputTokens: number;
}

// ─── Model routing ────────────────────────────────────────────

/**
 * Pick a model based on the user's request.
 * Simple read/explain tasks → haiku (fast, cheap).
 * Code changes or complex queries → sonnet.
 */
export function routeModel(userMessage: string, opts?: {
  lastInputTokens?: number;
  hasCodeEditsInHistory?: boolean;
}): string {
  const lower = userMessage.toLowerCase();

  const codeScore = CODE_CHANGE_KEYWORDS.filter(k => lower.includes(k)).length;
  const readScore = READ_ONLY_KEYWORDS.filter(k => lower.includes(k)).length;

  // Long messages are usually complex
  const isLong = userMessage.length > 300;

  // Large context implies complex ongoing work
  if (opts?.lastInputTokens && opts.lastInputTokens > 80_000) return MODEL_COMPLEX;

  // Short follow-up after code edits — keep using capable model
  if (opts?.hasCodeEditsInHistory && userMessage.length < 100) return MODEL_COMPLEX;

  if (codeScore > 0 || isLong) return MODEL_COMPLEX;
  if (readScore > 0 && codeScore === 0) return MODEL_SIMPLE;
  return MODEL_COMPLEX; // default to capable model
}

// ─── Cost calculator ──────────────────────────────────────────

/**
 * Compute USD cost for a given model and token counts.
 */
export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const [priceIn, priceOut] = MODEL_PRICING[model] ?? [3.0, 15.0];
  return (tokensIn / 1_000_000) * priceIn + (tokensOut / 1_000_000) * priceOut;
}

// ─── Context builder ──────────────────────────────────────────

/**
 * Build an enriched system prompt for the given workDir.
 * Includes repo fingerprint and top-ranked files.
 * Returns both the system prompt string and the raw repoMapBlock (for architect mode).
 */
export function buildSystemPrompt(
  workDir: string,
  repoFingerprint: string,
): { systemPrompt: string; repoMapBlock: string; rawRepoMap: import("./tree-sitter-map.js").RepoMap | null } {
  let rawRepoMap: import("./tree-sitter-map.js").RepoMap | null = null;
  const rankedFiles = rankFiles(workDir, 8);
  const fileList = rankedFiles.length > 0
    ? "\n\n## Key Files (ranked by importance)\n" +
      rankedFiles.map(f => `- ${f.path} (${f.reason})`).join("\n")
    : "";

  // Repo map: symbol-aware summary of top files (reuse already-ranked files)
  // Only run on source-like dirs (skip /tmp and similar system paths)
  let repoMapBlock = "";
  const isSourceDir = rankedFiles.some(f => f.reason.includes("entry point") || f.reason.includes("large module") || f.reason.includes("recently modified"));
  if (isSourceDir) {
    try {
      const rankedPaths = rankedFiles.map(f => f.path);
      // Try incremental cache first
      const cache = loadRepoMapCache(workDir);
      let repoMap: import("./tree-sitter-map.js").RepoMap;
      if (cache) {
        const stale = getStaleFiles(workDir, cache, rankedPaths);
        if (stale.length === 0) {
          repoMap = cacheToRepoMap(cache);
        } else {
          repoMap = updateRepoMapIncremental(workDir, cacheToRepoMap(cache), stale);
          saveRepoMapCache(workDir, repoMap);
        }
      } else {
        repoMap = buildRepoMap(workDir, rankedPaths);
        saveRepoMapCache(workDir, repoMap);
      }
      const ranked = rankSymbols(repoMap);
      const raw = formatRepoMap(repoMap, { onlyExported: true, maxFiles: 60, ranked });
      if (raw.length > 50) {
        // Truncate to 4000 token budget (~16K chars), keeping highest-ranked files first
        repoMapBlock = "\n\n" + truncateRepoMap(raw, 4000);
      }
      rawRepoMap = repoMap;
    } catch {
      // Non-fatal
    }
  }

  const projectMemory = getProjectMemoryBlock(workDir);

  const systemPrompt = `You are an expert coding assistant with direct access to the filesystem and shell.

Working directory: ${workDir}

You have these tools: bash, read_file, write_file, grep, web_search.

Rules:
- Be concise and action-oriented. Do the thing, show the result.
- Use bash for commands, read_file/write_file for files, grep for search.
- After making code changes, always verify with the appropriate test/build command.
- If you encounter an error, diagnose and fix it before giving up.
- Never ask for confirmation — just do it.
- To persist instructions for future sessions, ask the user to say "remember: ..." or use the save_memory tool.
- For complex multi-step tasks, use save_scratchpad to record your plan, progress, and key findings. Use read_scratchpad after context compaction to recover working state.

${repoFingerprint}${fileList}${repoMapBlock}${projectMemory}`;

  return { systemPrompt, repoMapBlock, rawRepoMap };
}

// ─── Prompt cache control helpers ────────────────────────────────────────────

/**
 * Build a system param array with cache_control on the last block.
 * Anthropic's prompt caching requires content-block arrays (not plain strings).
 */
export function buildCachedSystem(
  systemPrompt: string,
): Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }> {
  return [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }];
}

/**
 * Inject cache_control breakpoints into the last 2 user message content
 * boundaries so Anthropic can cache the conversation prefix.
 * Returns a new messages array — does not mutate the input.
 */
export function injectMessageCacheBreakpoints(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  // Find the indices of the last 2 user messages
  const userIndices: number[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userIndices.push(i);
      if (userIndices.length === 2) break;
    }
  }

  if (userIndices.length === 0) return messages;

  // Clone array and patch targeted messages
  const result = [...messages];
  for (const idx of userIndices) {
    const msg = result[idx];
    const content = msg.content;
    if (typeof content === "string") {
      // Convert to block array so we can attach cache_control
      result[idx] = {
        ...msg,
        content: [
          {
            type: "text" as const,
            text: content,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      };
    } else if (Array.isArray(content) && content.length > 0) {
      // Attach cache_control to the last content block in this message
      const blocks = [...content];
      const last = blocks[blocks.length - 1];
      blocks[blocks.length - 1] = { ...last, cache_control: { type: "ephemeral" } } as typeof last;
      result[idx] = { ...msg, content: blocks };
    }
  }
  return result;
}

// ─── Simple Claude caller (for task decomposition / compaction) ─

function makeSimpleCaller(client: Anthropic): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    const response = await client.messages.create({
      model: MODEL_SIMPLE,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  };
}

// ─── Tool execution ───────────────────────────────────────────

function makeExecTool(
  registry: ReturnType<typeof createDefaultRegistry>,
  workDir: string,
  onToolCall?: OrchestratorOptions["onToolCall"],
  onStatus?: OrchestratorOptions["onStatus"],
  onAddTokens?: (tokensIn: number, tokensOut: number) => void,
) {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    const tool = registry.get(name);
    if (!tool) return `Unknown tool: ${name}`;

    const ctx = {
      rootDir: workDir,
      log: () => {},
      defaultTimeout: tool.defaultTimeout,
      addTokens: onAddTokens,
    };

    onStatus?.(`Running ${name}...`);

    try {
      const { result } = await tool.handler(input, ctx);
      const inputStr = name === "bash"
        ? ((input as { command?: string }).command ?? JSON.stringify(input)).slice(0, 120)
        : JSON.stringify(input).slice(0, 120);
      onToolCall?.(name, inputStr, result);
      return result;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : err}`;
    }
  };
}

// ─── Streaming agent loop ─────────────────────────────────────

/**
 * Returns true if a tool result string looks like an error.
 */
export function isToolError(result: string): boolean {
  const lower = result.toLowerCase();
  return (
    lower.startsWith("error") ||
    lower.includes("enoent") ||
    lower.includes("no such file") ||
    lower.includes("command failed") ||
    lower.includes("cannot find")
  );
}

/**
 * Execute tool_use blocks with parallelism for read-only tools.
 * - Read-only tools (in PARALLEL_SAFE_TOOLS) run concurrently via Promise.all
 * - Side-effecting tools run sequentially after parallel reads complete
 * - Results are returned in the original tool_use order
 */
async function executeToolsParallel(
  tools: Anthropic.ToolUseBlock[],
  executeTool: (tu: Anthropic.ToolUseBlock) => Promise<string>,
): Promise<Array<{ type: "tool_result"; tool_use_id: string; content: string }>> {
  // Separate into parallel-safe and sequential groups, preserving original index
  const parallelEntries: Array<{ idx: number; tu: Anthropic.ToolUseBlock }> = [];
  const sequentialEntries: Array<{ idx: number; tu: Anthropic.ToolUseBlock }> = [];

  tools.forEach((tu, idx) => {
    if (PARALLEL_SAFE_TOOLS.has(tu.name)) {
      parallelEntries.push({ idx, tu });
    } else {
      sequentialEntries.push({ idx, tu });
    }
  });

  // Results array pre-allocated by original order
  const results: Array<{ type: "tool_result"; tool_use_id: string; content: string }> =
    new Array(tools.length);

  // Run parallel-safe tools concurrently
  await Promise.all(
    parallelEntries.map(async ({ idx, tu }) => {
      const content = await executeTool(tu);
      results[idx] = { type: "tool_result", tool_use_id: tu.id, content };
    }),
  );

  // Run sequential tools one by one (after parallel completes)
  for (const { idx, tu } of sequentialEntries) {
    const content = await executeTool(tu);
    results[idx] = { type: "tool_result", tool_use_id: tu.id, content };
  }

  return results;
}

async function runAgentLoop(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  apiMessages: Anthropic.MessageParam[],
  registry: ReturnType<typeof createDefaultRegistry>,
  workDir: string,
  onToolCall?: OrchestratorOptions["onToolCall"],
  onStatus?: OrchestratorOptions["onStatus"],
  onText?: OrchestratorOptions["onText"],
  onDiffPreview?: OrchestratorOptions["onDiffPreview"],
  onCompact?: (inputTokens: number, messages: Anthropic.MessageParam[]) => Promise<void>,
  onContextBudget?: OrchestratorOptions["onContextBudget"],
  onFileWatch?: (event: "read" | "write", filePath: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; tokensIn: number; tokensOut: number; lastInputTokens: number; aborted?: boolean }> {
  const execTool = makeExecTool(registry, workDir, onToolCall, onStatus, (tIn, tOut) => {
    totalIn += tIn;
    totalOut += tOut;
  });
  const tools = registry.getDefinitions();

  let totalIn = 0, totalOut = 0;
  let lastInput = 0;
  let cumulativeIn = 0;
  let fullText = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Check abort signal before starting a new round
    if (signal?.aborted) {
      return { text: fullText, tokensIn: totalIn, tokensOut: totalOut, lastInputTokens: lastInput, aborted: true };
    }

    // Inject prompt cache breakpoints for cost reduction (90% cheaper cache hits)
    const cachedSystem = buildCachedSystem(systemPrompt);
    const cachedMessages = injectMessageCacheBreakpoints(apiMessages);

    // Use streaming API with prompt-cache breakpoints (system as content blocks)
    // Extended thinking enabled: lets Claude reason before responding (better tool decisions, code, debugging)
    const streamParams = {
      model,
      max_tokens: MAX_TOKENS,
      system: cachedSystem as unknown as string,
      tools,
      messages: cachedMessages,
      thinking: {
        type: "enabled" as const,
        budget_tokens: 10_000,
      },
    };
    // Interleaved thinking beta: enables thinking between tool calls for Claude 4 models
    const stream = (client.messages as unknown as {
      stream(params: unknown, opts?: unknown): ReturnType<typeof client.messages.stream>
    }).stream(streamParams, {
      headers: { "anthropic-beta": "interleaved-thinking-2025-05-14" },
    }) as ReturnType<typeof client.messages.stream>;

    // Accumulate tool_use inputs (arrive as JSON deltas)
    const toolInputBuffers: Record<string, string> = {};

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          toolInputBuffers[event.index] = "";
        } else if ((event.content_block as { type: string }).type === "thinking") {
          // Thinking block started — notify UI but don't stream thinking text to user
          onStatus?.("Thinking...");
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          onText?.(event.delta.text);
          fullText += event.delta.text;
        } else if (event.delta.type === "input_json_delta") {
          toolInputBuffers[event.index] = (toolInputBuffers[event.index] ?? "") + event.delta.partial_json;
        }
        // thinking_delta: intentionally ignored — internal reasoning, not shown to users
      }
    }

    const finalMessage = await stream.finalMessage();

    lastInput = finalMessage.usage?.input_tokens ?? 0;
    totalIn += lastInput;
    cumulativeIn += lastInput;
    totalOut += finalMessage.usage?.output_tokens ?? 0;
    apiMessages.push({ role: "assistant", content: finalMessage.content });

    // Emit context budget ratio after each round so TUI footer updates live
    // Use cumulative input tokens (not per-call) so ratio reflects how full the context window is
    if (onContextBudget) {
      onContextBudget(cumulativeIn / COMPACT_TIER1_THRESHOLD);
    }

    // Mid-loop compaction: if context is growing large, compact between rounds
    if (onCompact && lastInput >= MICRO_COMPACT_THRESHOLD) {
      await onCompact(lastInput, apiMessages);
    }

    const toolUses = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length === 0) break;

    // Check abort before starting tool calls (allow in-flight calls to complete, don't start new ones)
    if (signal?.aborted) {
      return { text: fullText, tokensIn: totalIn, tokensOut: totalOut, lastInputTokens: lastInput, aborted: true };
    }

    // Separate write_file tools from non-write tools
    const writeTools = toolUses.filter(tu => tu.name === "write_file");
    const nonWriteTools = toolUses.filter(tu => tu.name !== "write_file");

    const results: Anthropic.ToolResultBlockParam[] = [];

    // Execute non-write tools (reads, greps, etc.) — parallel-safe ones run concurrently
    const parallelResults = await executeToolsParallel(nonWriteTools, async (tu) => {
      const rawResult = await execTool(tu.name, tu.input as Record<string, unknown>);
      const enhanced = enhanceToolError(tu.name, tu.input as Record<string, unknown>, rawResult, workDir);
      // Auto-retry once if the result looks like an error and enhancement added suggestions
      if (enhanced !== rawResult && isToolError(rawResult)) {
        const retryResult = await execTool(tu.name, tu.input as Record<string, unknown>);
        if (!isToolError(retryResult)) {
          // Retry succeeded — return clean result transparently
          if (tu.name === "read_file" && onFileWatch) {
            onFileWatch("read", (tu.input as { path?: string }).path ?? "");
          }
          return compressToolOutput(tu.name, retryResult);
        }
        // Both attempts failed — return enhanced error with suggestions
        const enhancedRetry = enhanceToolError(tu.name, tu.input as Record<string, unknown>, retryResult, workDir);
        if (tu.name === "read_file" && onFileWatch) {
          onFileWatch("read", (tu.input as { path?: string }).path ?? "");
        }
        return compressToolOutput(tu.name, `${enhanced}\n\n[Retry also failed]: ${enhancedRetry}`);
      }
      if (tu.name === "read_file" && onFileWatch) {
        onFileWatch("read", (tu.input as { path?: string }).path ?? "");
      }
      return compressToolOutput(tu.name, enhanced);
    });
    results.push(...parallelResults);

    // Handle write_file tools — batch if 2+ and onDiffPreview is set
    if (writeTools.length >= 2 && onDiffPreview) {
      const batchResults = await batchWriteFiles(writeTools, workDir, execTool, onDiffPreview, onFileWatch);
      results.push(...batchResults);
    } else {
      // Single write_file (or no preview callback) — existing per-file flow
      for (const tu of writeTools) {
        if (tu.name === "write_file" && onDiffPreview) {
          const inp = tu.input as { path?: string; content?: string; mode?: string };
          const relPath = inp.path ?? "";
          const newContent = inp.content ?? "";
          const fullPath = fs.existsSync(relPath) ? relPath
            : `${workDir}/${relPath}`;
          let oldContent = "";
          try { oldContent = fs.readFileSync(fullPath, "utf-8"); } catch { /* new file */ }
          const diff = computeUnifiedDiff(oldContent, newContent, relPath);
          if (diff) {
            const accepted = await onDiffPreview(diff, relPath);
            if (!accepted) {
              results.push({ type: "tool_result", tool_use_id: tu.id, content: `User rejected edit to ${relPath}` });
              continue;
            }
          }
        }
        const rawResult = await execTool(tu.name, tu.input as Record<string, unknown>);
        if (onFileWatch) {
          onFileWatch("write", (tu.input as { path?: string }).path ?? "");
        }
        const result = compressToolOutput(tu.name, rawResult);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      }
    }

    apiMessages.push({ role: "user", content: results });

    if (finalMessage.stop_reason === "end_turn") break;
  }

  return { text: fullText, tokensIn: totalIn, tokensOut: totalOut, lastInputTokens: lastInput };
}

/**
 * Batch-preview and apply multiple write_file tool calls together.
 * Shows a single unified diff for all files, then applies or rejects atomically.
 * On partial failure, rolls back already-written files.
 */
async function batchWriteFiles(
  toolUses: Array<Anthropic.ToolUseBlock>,
  workDir: string,
  execTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  onDiffPreview: (diff: string, label: string) => Promise<boolean>,
  onFileWatch?: (event: "read" | "write", filePath: string) => void,
): Promise<Anthropic.ToolResultBlockParam[]> {
  type FileEdit = {
    id: string;
    relPath: string;
    fullPath: string;
    oldContent: string;
    newContent: string;
    diff: string;
    input: Record<string, unknown>;
  };

  // Collect phase — compute diffs without writing
  const edits: FileEdit[] = [];
  for (const tu of toolUses) {
    const inp = tu.input as { path?: string; content?: string; mode?: string };
    const relPath = inp.path ?? "";
    const newContent = inp.content ?? "";
    const fullPath = fs.existsSync(relPath) ? relPath : `${workDir}/${relPath}`;
    let oldContent = "";
    try { oldContent = fs.readFileSync(fullPath, "utf-8"); } catch { /* new file */ }
    const diff = computeUnifiedDiff(oldContent, newContent, relPath);
    edits.push({ id: tu.id, relPath, fullPath, oldContent, newContent, diff, input: tu.input as Record<string, unknown> });
  }

  // Preview phase — combine all diffs into one preview
  const diffsWithContent = edits.filter(e => e.diff);
  if (diffsWithContent.length > 0) {
    const combinedDiff = diffsWithContent
      .map(e => e.diff)
      .join("\n--- file boundary ---\n");
    const label = `${edits.length} files`;
    const accepted = await onDiffPreview(combinedDiff, label);
    if (!accepted) {
      return edits.map(e => ({
        type: "tool_result" as const,
        tool_use_id: e.id,
        content: `User rejected batch edit to ${e.relPath}`,
      }));
    }
  }

  // Apply phase — snapshot first for rollback, then write
  const snapshots: Array<{ fullPath: string; oldContent: string; existed: boolean }> = [];
  const results: Anthropic.ToolResultBlockParam[] = [];

  for (const edit of edits) {
    const existed = fs.existsSync(edit.fullPath);
    snapshots.push({ fullPath: edit.fullPath, oldContent: edit.oldContent, existed });
    try {
      const rawResult = await execTool("write_file", edit.input);
      onFileWatch?.("write", edit.relPath);
      const result = compressToolOutput("write_file", rawResult);
      results.push({ type: "tool_result", tool_use_id: edit.id, content: result });
    } catch (err) {
      // Rollback all already-written files
      for (const snap of snapshots.slice(0, -1)) {
        try {
          if (snap.existed) {
            fs.writeFileSync(snap.fullPath, snap.oldContent, "utf-8");
          } else {
            fs.unlinkSync(snap.fullPath);
          }
        } catch { /* best-effort rollback */ }
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      // Return error for failed edit and rejections for remaining
      const failIdx = edits.indexOf(edit);
      const errorResults: Anthropic.ToolResultBlockParam[] = [];
      for (let i = 0; i < edits.length; i++) {
        if (i < failIdx) {
          // Already-applied: rolled back
          errorResults.push({ type: "tool_result", tool_use_id: edits[i].id, content: `Rolled back due to batch failure: ${errMsg}` });
        } else if (i === failIdx) {
          errorResults.push({ type: "tool_result", tool_use_id: edits[i].id, content: `Error applying batch edit: ${errMsg}` });
        } else {
          errorResults.push({ type: "tool_result", tool_use_id: edits[i].id, content: `Skipped due to batch failure` });
        }
      }
      return errorResults;
    }
  }

  return results;
}

// ─── Orchestrator class ───────────────────────────────────────

export class Orchestrator {
  private client: Anthropic;
  private registry: ReturnType<typeof createDefaultRegistry>;
  private repoFingerprint: string = "";
  private systemPrompt: string = "";
  private repoMapBlock: string = "";
  private apiMessages: Anthropic.MessageParam[] = [];
  private opts: OrchestratorOptions;
  private initialized = false;
  /** Model override — if set, bypasses routeModel() */
  private modelOverride: string | null = null;

  // Cost tracking
  private sessionTokensIn = 0;
  private sessionTokensOut = 0;
  private sessionCost = 0;
  private lastInputTokens = 0;
  /** Timestamp when this Orchestrator was constructed (session start). */
  private sessionStartTime = Date.now();
  /** Cost of each completed turn, for trend analysis. */
  private turnCosts: number[] = [];

  /** AbortController for the current send() call. Null when idle. */
  _abortController: AbortController | null = null;

  /** Prevents the 80% context warning from firing more than once per session. */
  private contextWarningShown = false;

  /** Whether project summary has been injected into the system prompt already. */
  private projectSummaryInjected = false;
  /** Cached project summary from detectProject(). */
  private projectSummary: string = "";

  /** Path to current session's JSONL file */
  sessionPath: string = "";

  /** Conversation checkpoints for /rewind command. */
  private checkpoints: ConversationCheckpoint[] = [];
  private nextCheckpointId = 0;

  /** FileWatcher instance — tracks externally modified files. */
  private fileWatcher = new FileWatcher();
  /** Paths changed externally since last send(). */
  private externallyChangedFiles = new Set<string>();
  /** Cached repo map for incremental reindex — null means full rebuild needed. */
  private cachedRepoMap: import("./tree-sitter-map.js").RepoMap | null = null;
  /** Paths that have been changed externally and need incremental re-parse. */
  private staleRepoPaths = new Set<string>();

  constructor(opts: OrchestratorOptions) {
    this.opts = opts;
    this.client = new Anthropic();
    this.registry = createDefaultRegistry();

    // Wire up file watcher callback
    this.fileWatcher.onChange = (filePath: string) => {
      this.externallyChangedFiles.add(filePath);
      // Mark this path stale in the incremental repo map cache
      this.staleRepoPaths.add(filePath);
      this.opts.onExternalFileChange?.([...this.externallyChangedFiles]);
    };
  }

  /** Initialize repo context (call once before first message). */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.opts.onStatus?.("Indexing repo...");
    this.repoFingerprint = fingerprintRepo(this.opts.workDir);
    const initBuildResult = buildSystemPrompt(this.opts.workDir, this.repoFingerprint);
    this.systemPrompt = initBuildResult.systemPrompt;
    this.repoMapBlock = initBuildResult.repoMapBlock;
    if (initBuildResult.rawRepoMap) this.setRepoMapCache(initBuildResult.rawRepoMap);
    // Cache project summary and inject into system prompt
    try {
      const projectInfo = detectProject(this.opts.workDir);
      this.projectSummary = projectInfo.summary;
      if (this.projectSummary) {
        this.systemPrompt += `\n\n## Project Context\n${this.projectSummary}`;
      }
    } catch {
      // Non-fatal
    }

    // Session persistence: resume or create new
    if (this.opts.resumeSessionPath) {
      this.sessionPath = this.opts.resumeSessionPath;
      this.apiMessages = loadSession(this.sessionPath);
    } else {
      this.sessionPath = initSession(this.opts.workDir);
    }

    // Clean up old sessions non-blocking
    setImmediate(() => cleanOldSessions(this.opts.workDir));

    this.initialized = true;
    this.opts.onStatus?.("");
  }

  /**
   * Resume an existing session by loading its history.
   * Can be called after init() to switch sessions.
   */
  resumeSession(sessionPath: string): void {
    this.sessionPath = sessionPath;
    this.apiMessages = loadSession(sessionPath);
    // Reset cost tracking to reflect reloaded context
    this.sessionTokensIn = 0;
    this.sessionTokensOut = 0;
    this.sessionCost = 0;
  }

  /** Clear conversation history (but keep repo context). */
  clearHistory(): void {
    this.apiMessages = [];
    this.sessionTokensIn = 0;
    this.sessionTokensOut = 0;
    this.sessionCost = 0;
    this.contextWarningShown = false;
    this.checkpoints = [];
    this.nextCheckpointId = 0;
    this.fileWatcher.unwatchAll();
  }

  /**
   * Save a checkpoint of the current conversation state.
   * Called before each user message is processed.
   * Keeps at most MAX_CHECKPOINTS; drops oldest when cap exceeded.
   */
  saveCheckpoint(label: string): void {
    const checkpoint: ConversationCheckpoint = {
      id: this.nextCheckpointId++,
      label: label.slice(0, 60),
      messages: this.apiMessages.map(m => ({ ...m })),
      timestamp: Date.now(),
    };
    this.checkpoints.push(checkpoint);
    if (this.checkpoints.length > MAX_CHECKPOINTS) {
      this.checkpoints.shift();
    }
  }

  /**
   * Restore conversation to the state at a given checkpoint id.
   * Returns the checkpoint label on success, null if not found.
   */
  rewindTo(id: number): { label: string } | null {
    const cp = this.checkpoints.find(c => c.id === id);
    if (!cp) return null;
    this.apiMessages = cp.messages.map(m => ({ ...m }));
    return { label: cp.label };
  }

  /** Get all current checkpoints (most recent last). */
  getCheckpoints(): ConversationCheckpoint[] {
    return [...this.checkpoints];
  }

  /** Re-index the repo (after significant changes). Uses incremental update when possible. */
  reindex(): void {
    this.repoFingerprint = fingerprintRepo(this.opts.workDir);
    if (this.cachedRepoMap && this.staleRepoPaths.size > 0) {
      // Incremental: only re-parse changed files
      const changedFiles = [...this.staleRepoPaths];
      this.staleRepoPaths.clear();
      this.cachedRepoMap = updateRepoMapIncremental(
        this.opts.workDir,
        this.cachedRepoMap,
        changedFiles,
      );
      saveRepoMapCache(this.opts.workDir, this.cachedRepoMap);
      // Rebuild system prompt using updated cache
      ({ systemPrompt: this.systemPrompt, repoMapBlock: this.repoMapBlock } =
        buildSystemPrompt(this.opts.workDir, this.repoFingerprint));
    } else if (this.cachedRepoMap && this.staleRepoPaths.size === 0) {
      // Nothing stale — no-op for repo map, just refresh fingerprint/system prompt
      this.staleRepoPaths.clear();
      ({ systemPrompt: this.systemPrompt, repoMapBlock: this.repoMapBlock } =
        buildSystemPrompt(this.opts.workDir, this.repoFingerprint));
    } else {
      // No cache — full rebuild
      ({ systemPrompt: this.systemPrompt, repoMapBlock: this.repoMapBlock } =
        buildSystemPrompt(this.opts.workDir, this.repoFingerprint));
    }
  }

  /**
   * Store the most recently built repo map for use in incremental reindex.
   * Called by buildSystemPrompt internals via the orchestrator init flow.
   */
  setRepoMapCache(repoMap: import("./tree-sitter-map.js").RepoMap): void {
    this.cachedRepoMap = repoMap;
    this.staleRepoPaths.clear();
  }

  /** Get the current cached repo map (null if not yet built). */
  getRepoMapCache(): import("./tree-sitter-map.js").RepoMap | null {
    return this.cachedRepoMap;
  }

  /** Get current session cost info. */
  getCost(): CostInfo {
    return {
      cost: this.sessionCost,
      tokensIn: this.sessionTokensIn,
      tokensOut: this.sessionTokensOut,
      lastInputTokens: this.lastInputTokens,
    };
  }

  /** Abort any in-progress send() call. Safe to call when idle. */
  abort(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /** Session statistics for /status display. */
  getSessionStats(): { durationMs: number; turnCount: number; avgCostPerTurn: number; costTrend: "↑" | "→" | "↓" } {
    const durationMs = Date.now() - this.sessionStartTime;
    const turnCount = this.turnCosts.length;
    const avgCostPerTurn = turnCount > 0 ? this.sessionCost / turnCount : 0;
    let costTrend: "↑" | "→" | "↓" = "→";
    if (turnCount >= 3) {
      const recentAvg = this.turnCosts.slice(-3).reduce((a, b) => a + b, 0) / 3;
      if (recentAvg > avgCostPerTurn * 1.2) costTrend = "↑";
      else if (recentAvg < avgCostPerTurn * 0.8) costTrend = "↓";
    }
    return { durationMs, turnCount, avgCostPerTurn, costTrend };
  }

  /** Get the current model (override if set, otherwise "auto"). */
  getModel(): string {
    return this.modelOverride ?? "auto";
  }

  /** Override model for all subsequent sends. Pass null to restore auto-routing. */
  setModel(model: string | null): void {
    this.modelOverride = model;
  }

  /** Clear the model override, restoring keyword-based auto-routing. */
  resetModelOverride(): void {
    this.modelOverride = null;
  }

  /** Check if micro-compaction is needed (clear old tool result contents ~80K). */
  private shouldMicroCompact(): boolean {
    return this.sessionTokensIn >= MICRO_COMPACT_THRESHOLD && this.sessionTokensIn < COMPACT_TIER1_THRESHOLD;
  }

  /** Check if Tier 1 compaction is needed (compress old tool outputs). */
  private shouldCompactTier1(): boolean {
    return this.sessionTokensIn >= COMPACT_TIER1_THRESHOLD && this.sessionTokensIn < COMPACT_THRESHOLD;
  }

  /** Check if Tier 2 compaction is needed (summarize old messages). */
  private shouldCompact(): boolean {
    return this.sessionTokensIn >= COMPACT_THRESHOLD;
  }

  /** Check if stale tool result pruning is needed (at or above micro-compact threshold). */
  private shouldPruneStaleTool(): boolean {
    return this.sessionTokensIn >= MICRO_COMPACT_THRESHOLD;
  }

  /**
   * Determine the "prune priority" for a tool result.
   * Lower number = prune first (low value); higher number = prune last (high value).
   *
   * Priority:
   *   0 — read_file, grep, list_files (always re-readable)
   *   1 — other tools (moderate value)
   *   2 — bash, write_file (high value — may contain errors or created content)
   */
  private toolPrunePriority(toolName: string): number {
    if (["read_file", "grep", "list_files"].includes(toolName)) return 0;
    if (["bash", "write_file"].includes(toolName)) return 2;
    return 1;
  }

  /**
   * Build a map from tool_use_id → tool name by scanning all assistant messages.
   */
  private buildToolUseIdMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const msg of this.apiMessages) {
      if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        if (
          typeof block === "object" &&
          "type" in block &&
          block.type === "tool_use" &&
          "id" in block &&
          "name" in block
        ) {
          map.set(
            (block as { id: string; name: string }).id,
            (block as { id: string; name: string }).name,
          );
        }
      }
    }
    return map;
  }

  /** Return true if the text contains error indicators we must preserve. */
  private hasErrorIndicator(text: string): boolean {
    return /\bError\b|FAIL|error:|ERR!/.test(text);
  }

  /**
   * Prune stale tool results with priority-based ordering.
   *
   * Fires at MICRO_COMPACT_THRESHOLD (80K) and above.
   * - Never prunes results that contain error indicators.
   * - Prunes low-value tools first (read_file, grep, list_files).
   * - Prunes high-value tools last (bash, write_file).
   * - Keeps the last 8 assistant turns untouched.
   */
  pruneStaleToolResults(): void {
    const toolUseIdMap = this.buildToolUseIdMap();

    // Find the index of the 8th most recent assistant message
    const assistantIndices: number[] = [];
    for (let i = this.apiMessages.length - 1; i >= 0; i--) {
      if (this.apiMessages[i].role === "assistant") {
        assistantIndices.push(i);
      }
    }

    // Keep last 8 assistant turns fresh — prune everything older
    const cutoffAssistantIdx = assistantIndices[7] ?? 0; // 8th most recent assistant turn

    // Collect all candidate tool_result blocks with their priority
    type Candidate = {
      cb: { type: string; text?: string };
      turnN: number;
      priority: number;
    };
    const candidates: Candidate[] = [];

    let turnN = 0;
    for (let i = 0; i < cutoffAssistantIdx; i++) {
      const msg = this.apiMessages[i];
      if (msg.role === "assistant") turnN++;
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;

      for (const block of msg.content) {
        if (
          typeof block === "object" &&
          "type" in block &&
          block.type === "tool_result" &&
          Array.isArray((block as { content?: unknown[] }).content)
        ) {
          const toolBlock = block as {
            type: string;
            tool_use_id: string;
            content: Array<{ type: string; text?: string }>;
          };
          const toolName = toolUseIdMap.get(toolBlock.tool_use_id) ?? "unknown";
          const priority = this.toolPrunePriority(toolName);

          for (const cb of toolBlock.content) {
            if (cb.type === "text" && typeof cb.text === "string") {
              // Skip already-compact results
              if (cb.text.length < 100) continue;
              // Never prune error-containing results
              if (this.hasErrorIndicator(cb.text)) continue;
              candidates.push({ cb, turnN, priority });
            }
          }
        }
      }
    }

    // Build a set of all identifiers (file paths, function names) referenced in
    // assistant messages *after* the cutoff so we can boost retained results.
    const assistantTextAfterCutoff = this.apiMessages
      .slice(cutoffAssistantIdx)
      .filter(m => m.role === "assistant")
      .map(m => {
        if (typeof m.content === "string") return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .map((b: unknown) => (typeof b === "string" ? b : (b as { text?: string }).text ?? ""))
            .join(" ");
        }
        return "";
      })
      .join("\n");

    /**
     * Extract key identifiers from a tool result text:
     * - file paths (e.g. src/foo.ts)
     * - identifiers that look like symbol names (camelCase / PascalCase / snake_case, ≥4 chars)
     */
    function extractIdentifiers(text: string): string[] {
      const paths = text.match(/[\w./\-]+\.\w{1,6}/g) ?? [];
      const symbols = text.match(/\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b/g) ?? [];
      return [...new Set([...paths, ...symbols])];
    }

    // Sort by age-weighted priority: older + lower-priority results pruned first.
    // Referenced results get a 2x retention boost (harder to prune).
    // ageFactor = max(0.3, 1 - age/totalMessages), where age = distance from end.
    const totalMessages = this.apiMessages.length;
    candidates.sort((a, b) => {
      const ageA = totalMessages - a.turnN;
      const ageB = totalMessages - b.turnN;
      const freshnessA = Math.max(0.3, 1 - ageA / totalMessages);
      const freshnessB = Math.max(0.3, 1 - ageB / totalMessages);

      // Check if this result is back-referenced by later assistant messages
      const textA = a.cb.text ?? "";
      const textB = b.cb.text ?? "";
      const referencedA = extractIdentifiers(textA).some(id => assistantTextAfterCutoff.includes(id));
      const referencedB = extractIdentifiers(textB).some(id => assistantTextAfterCutoff.includes(id));
      const refBoostA = referencedA ? 2 : 1;
      const refBoostB = referencedB ? 2 : 1;

      const scoreA = a.priority * freshnessA * refBoostA;
      const scoreB = b.priority * freshnessB * refBoostB;
      return scoreA - scoreB || a.turnN - b.turnN;
    });

    // Prune all candidates (already filtered — no errors, no fresh turns)
    for (const { cb, turnN: t } of candidates) {
      cb.text = `[pruned — old result from turn ${t}]`;
    }
  }

  /**
   * Tier 1 compaction: walk apiMessages backwards, compress tool_result blocks
   * older than the last 5 assistant turns to reduce context without losing structure.
   */
  private compactTier1(): void {
    this.opts.onStatus?.("Compressing tool outputs...");

    // Find the indices of assistant messages (most recent first)
    const assistantIndices: number[] = [];
    for (let i = this.apiMessages.length - 1; i >= 0; i--) {
      if (this.apiMessages[i].role === "assistant") {
        assistantIndices.push(i);
      }
    }

    // Keep the last 5 assistant turns fresh — compress everything older
    const cutoffAssistantIdx = assistantIndices[4] ?? 0; // 5th most recent assistant turn

    for (let i = 0; i < cutoffAssistantIdx; i++) {
      const msg = this.apiMessages[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;

      for (const block of msg.content) {
        if (
          typeof block === "object" &&
          "type" in block &&
          block.type === "tool_result" &&
          Array.isArray((block as { content?: unknown[] }).content)
        ) {
          const toolBlock = block as {
            type: string;
            tool_use_id: string;
            content: Array<{ type: string; text?: string }>;
          };
          for (const cb of toolBlock.content) {
            if (cb.type === "text" && typeof cb.text === "string") {
              // Derive tool name from the tool_use_id prefix if possible
              const toolName = cb.text.startsWith("Error") ? "error" : "bash";
              cb.text = compressToolOutput(toolName, cb.text, 1500);
            }
          }
        }
      }
    }

    this.opts.onStatus?.("");
  }

  /**
   * Compact conversation: summarize old messages, replace with summary.
   * Keeps the last 2 exchanges (4 messages) intact.
   */
  private async compact(): Promise<void> {
    this.opts.onStatus?.("Compacting context...");
    const caller = makeSimpleCaller(this.client);

    // Keep last 4 messages (2 exchanges) fresh
    const keepCount = 4;
    if (this.apiMessages.length <= keepCount) return;

    const toSummarize = this.apiMessages.slice(0, -keepCount);
    const toKeep = this.apiMessages.slice(-keepCount);

    // Build a text representation for summarization
    const convText = toSummarize.map(m => {
      const role = m.role.toUpperCase();
      const content = Array.isArray(m.content)
        ? m.content
            .map(b => (typeof b === "object" && "text" in b ? b.text : ""))
            .filter(Boolean)
            .join(" ")
        : String(m.content);
      return `${role}: ${content}`;
    }).join("\n\n");

    const summary = await caller(
      `Summarize this conversation into the following structured format. Use exactly these section headers:\n\n## Current Task\nWhat the user is currently trying to accomplish.\n\n## Plan & Progress\nStep-by-step plan and which steps are done, in-progress, or pending.\n\n## Files Modified\nList of files that were created, edited, or deleted.\n\n## Key Decisions\nImportant choices made (libraries chosen, approaches taken, things ruled out).\n\n## Open Questions\nUnresolved issues, errors, or things that still need attention.\n\nConversation to summarize:\n\n${convText}`
    );

    this.apiMessages = [
      { role: "user", content: `[Conversation summary]\n${summary}` },
      { role: "assistant", content: "I have the context from the earlier conversation." },
      ...toKeep,
    ];

    // Reset token counter after compaction (context is now much smaller)
    this.sessionTokensIn = Math.min(this.sessionTokensIn, 20_000);
    this.opts.onStatus?.("");
  }

  /** Manually trigger context compaction (called from /compact TUI command). */
  async compactNow(): Promise<void> {
    await this.compact();
    this.opts.onStatus?.("Context compacted.");
  }

  /**
   * Process a user message through the full orchestration pipeline:
   * 1. Route to appropriate model
   * 2. Optionally compact context
   * 3. Optionally decompose complex tasks
   * 4. Run streaming agent loop
   * 5. Verify if code was changed
   */
  async send(userMessage: string): Promise<OrchestratorResult> {
    if (!this.initialized) await this.init();
    // Create fresh AbortController for this send() call
    this._abortController = new AbortController();

    // 0. Project summary injection (once per session)
    if (!this.projectSummaryInjected) {
      try {
        const projectInfo = detectProject(this.opts.workDir);
        if (projectInfo.type !== "unknown") {
          const contextLines: string[] = [projectInfo.summary];
          if (projectInfo.testRunner) contextLines.push(`Test runner: ${projectInfo.testRunner}.`);
          if (projectInfo.packageManager) contextLines.push(`Package manager: ${projectInfo.packageManager}.`);
          if (projectInfo.entryPoints?.length) contextLines.push(`Entry points: ${projectInfo.entryPoints.join(", ")}.`);
          if (projectInfo.framework) contextLines.push(`Framework: ${projectInfo.framework}.`);
          this.systemPrompt += `\n\n## Project Context\n${contextLines.join(" ")}`;
        }
      } catch { /* non-fatal — skip if detection fails */ }
      this.projectSummaryInjected = true;
    }

    // 0b. Prepend external file change warning if any files changed since last send
    if (this.externallyChangedFiles.size > 0) {
      const paths = [...this.externallyChangedFiles];
      userMessage = `⚠️ Files changed externally since last read: ${paths.join(", ")}. Consider re-reading them.\n\n${userMessage}`;
      this.externallyChangedFiles.clear();
    }

    // 1. Model routing
    const hasCodeEditsInHistory = this.apiMessages.some(m =>
      m.role === "assistant" &&
      Array.isArray(m.content) &&
      m.content.some((b: { type: string }) => b.type === "tool_use")
    );
    const model = this.modelOverride ?? routeModel(userMessage, {
      lastInputTokens: this.lastInputTokens,
      hasCodeEditsInHistory,
    });
    this.opts.onStatus?.(`Using ${model === MODEL_COMPLEX ? "Sonnet" : "Haiku"}...`);

    // 1b. Token budget warning — emit ratio before compaction so TUI can warn user
    const budgetRatio = this.sessionTokensIn / COMPACT_TIER1_THRESHOLD;
    this.opts.onContextBudget?.(budgetRatio);

    // 2. Context compaction if needed (tiered)
    if (this.shouldCompact()) {
      await this.compact(); // Tier 2: summarize
      // After compaction, notify TUI that budget is now low
      this.opts.onContextBudget?.(this.sessionTokensIn / COMPACT_TIER1_THRESHOLD);
    } else if (this.shouldCompactTier1()) {
      this.compactTier1(); // Tier 1: compress old tool outputs
      if (this.shouldPruneStaleTool()) {
        this.pruneStaleToolResults(); // Aggressive eviction between T1 and T2
      }
    } else if (this.shouldMicroCompact()) {
      scoredPrune(this.apiMessages, this.apiMessages.length, 10_000); // Scored prune: target 10K token savings
    }

    // 2b. Extract #file references from user message, inject as context
    const fileRefs = extractFileReferences(userMessage, this.opts.workDir);
    let fileRefContext = "";
    if (fileRefs.length > 0) {
      fileRefContext = loadFileReferences(fileRefs, this.opts.workDir);
      this.opts.onStatus?.(`Loading ${fileRefs.length} referenced file${fileRefs.length > 1 ? "s" : ""}...`);
    }
    // Strip # prefixes so model sees clean text
    const cleanMessage = fileRefs.length > 0 ? stripFileReferences(userMessage) : userMessage;

    // 3. Task decomposition for complex tasks
    let effectiveMessage = cleanMessage;
    if (shouldDecompose(userMessage)) {
      this.opts.onStatus?.("Decomposing task...");
      const caller = makeSimpleCaller(this.client);
      const subtasks = await decomposeTasks(userMessage, caller);
      if (subtasks.length > 1) {
        const decomposition = formatSubtasks(subtasks);
        effectiveMessage = `${userMessage}\n\n${decomposition}`;
      }
    }

    // 3b. Architect mode: two-phase plan→edit for complex tasks
    const architectResult = await runArchitectMode(
      userMessage,
      this.repoMapBlock,
      makeSimpleCaller(this.client),
      this.repoMapBlock, // repo map injected into plan prompt (truncated to 8K internally)
    );
    if (architectResult.activated) {
      this.opts.onStatus?.("Architect mode: plan generated");
      this.opts.onPlan?.(architectResult.plan);
    }

    // 4. Save checkpoint BEFORE adding user message (so rewind restores pre-message state)
    this.saveCheckpoint(userMessage);

    // 4. Add user message to history and persist
    // Prepend file reference context if present
    const messageWithContext = fileRefContext
      ? `${fileRefContext}\n\n---\n\nUser message: ${effectiveMessage}`
      : effectiveMessage;
    const userMsg: Anthropic.MessageParam = { role: "user", content: messageWithContext };
    this.apiMessages.push(userMsg);
    if (this.sessionPath) saveMessage(this.sessionPath, userMsg);

    // 4b. Inject architect plan as prefilled assistant message
    if (architectResult.activated && architectResult.prefill) {
      this.apiMessages.push({ role: "assistant", content: architectResult.prefill });
      // Inject context file guidance so the executor reads them first
      if (architectResult.plan.contextFiles?.length) {
        const ctxNote = `Before editing, read these context files: ${architectResult.plan.contextFiles.join(", ")}`;
        this.apiMessages.push({ role: "user", content: ctxNote });
      }
    }

    this.opts.onStatus?.("Thinking...");

    // 5. Run streaming agent loop
    // Build mid-loop compaction callback
    const onCompact = async (inputTokens: number, messages: Anthropic.MessageParam[]): Promise<void> => {
      const tier = selectCompactionTier(inputTokens);
      if (tier === 'tier2') {
        await this.compact();
      } else if (tier === 'tier1') {
        this.compactTier1();
      } else if (tier === 'micro') {
        scoredPrune(messages, messages.length, 10_000);
      }
      this.opts.onContextBudget?.(this.sessionTokensIn / COMPACT_TIER1_THRESHOLD);
    };

    const fileWatchCallback = (event: "read" | "write", filePath: string) => {
      if (event === "read") this.fileWatcher.watch(filePath);
      if (event === "write") {
        this.fileWatcher.watch(filePath);
        this.fileWatcher.mute(filePath);
      }
    };

    const loopResult = await runAgentLoop(
      this.client,
      model,
      this.systemPrompt,
      this.apiMessages,
      this.registry,
      this.opts.workDir,
      this.opts.onToolCall,
      this.opts.onStatus,
      this.opts.onText,
      this.opts.onDiffPreview,
      onCompact,
      this.opts.onContextBudget,
      fileWatchCallback,
      this._abortController?.signal,
    );
    const { text, tokensIn, tokensOut, lastInputTokens, aborted } = loopResult;

    // Persist assistant reply (last assistant message in history)
    if (this.sessionPath && text) {
      const assistantMsg: Anthropic.MessageParam = { role: "assistant", content: text };
      saveMessage(this.sessionPath, assistantMsg);
    }

    // Accumulate cost
    this.sessionTokensIn += tokensIn;
    this.sessionTokensOut += tokensOut;
    const turnCost = computeCost(model, tokensIn, tokensOut);
    this.sessionCost += turnCost;
    this.turnCosts.push(turnCost);
    this.lastInputTokens = lastInputTokens;

    // If aborted, return early with partial result
    if (aborted) {
      this._abortController = null;
      return { text: text || "⏹ Generation cancelled.", tokensIn, tokensOut, model, verificationPassed: undefined };
    }

    // Proactive context budget warning — fire once when crossing 80% of T2 threshold
    if (
      !this.contextWarningShown &&
      this.opts.onContextWarning &&
      lastInputTokens >= CONTEXT_WARNING_THRESHOLD
    ) {
      this.contextWarningShown = true;
      this.opts.onContextWarning();
    }

    // 6. Self-verification (if code was likely changed)
    let verificationPassed: boolean | undefined;
    const looksLikeCodeChange = CODE_CHANGE_KEYWORDS.some(k =>
      userMessage.toLowerCase().includes(k)
    );
    if (looksLikeCodeChange && this.opts.workDir !== process.cwd()) {
      this.opts.onStatus?.("Verifying changes...");
      const results = await runVerification(this.opts.workDir, this.repoFingerprint);
      if (results.length > 0) {
        verificationPassed = results.every(r => r.passed);
        const formatted = formatVerificationResults(results);
        if (formatted && !verificationPassed) {
          // Inject verification failure into conversation so agent can fix
          this.apiMessages.push({
            role: "user",
            content: `Verification results:\n${formatted}\n\nPlease fix any failures.`,
          });
          this.opts.onStatus?.("Fixing verification failures...");
          await runAgentLoop(
            this.client,
            model,
            this.systemPrompt,
            this.apiMessages,
            this.registry,
            this.opts.workDir,
            this.opts.onToolCall,
            this.opts.onStatus,
            this.opts.onText,
            this.opts.onDiffPreview,
            undefined,
            undefined,
            fileWatchCallback,
          );
        }
      }
    }

    // 7. Auto-commit if code was likely changed
    let commitResult: AutoCommitResult | undefined;
    if (looksLikeCodeChange) {
      commitResult = await autoCommit(this.opts.workDir, userMessage);
      if (commitResult.committed) {
        this.opts.onStatus?.(`✓ Committed ${commitResult.hash}: ${commitResult.message}`);
      }

      // 8. Post-edit diagnostics: run tsc after commit, auto-fix if errors
      const MAX_DIAG_RETRIES = 3;
      for (let diagRetry = 0; diagRetry < MAX_DIAG_RETRIES; diagRetry++) {
        const diagErrors = await runDiagnostics(this.opts.workDir);
        if (!diagErrors) break; // Clean — no errors

        const errorCount = (diagErrors.match(/error TS/g) ?? []).length || 1;
        this.opts.onStatus?.(`⚠ ${errorCount} TS error${errorCount > 1 ? "s" : ""} — auto-fixing (${diagRetry + 1}/${MAX_DIAG_RETRIES})…`);

        this.apiMessages.push({
          role: "user",
          content: `TypeScript errors after edit:\n\`\`\`\n${diagErrors}\n\`\`\`\nPlease fix these errors.`,
        });

        const fixResult = await runAgentLoop(
          this.client,
          model,
          this.systemPrompt,
          this.apiMessages,
          this.registry,
          this.opts.workDir,
          this.opts.onToolCall,
          this.opts.onStatus,
          this.opts.onText,
          this.opts.onDiffPreview,
          undefined,
          undefined,
          fileWatchCallback,
        );

        this.sessionTokensIn += fixResult.tokensIn;
        this.sessionTokensOut += fixResult.tokensOut;
        this.sessionCost += computeCost(model, fixResult.tokensIn, fixResult.tokensOut);

        // Re-commit the fix
        const fixCommit = await autoCommit(this.opts.workDir, "fix TypeScript errors");
        if (fixCommit.committed) {
          commitResult = fixCommit;
          this.opts.onStatus?.(`✓ Fix committed ${fixCommit.hash}: ${fixCommit.message}`);
        }
      }

      // 9. Run related tests after diagnostics pass
      const writtenFiles = this.apiMessages
        .flatMap(m => (Array.isArray(m.content) ? m.content : []))
        .filter((b): b is Anthropic.ToolUseBlock => (b as Anthropic.ToolUseBlock).type === "tool_use" && (b as Anthropic.ToolUseBlock).name === "write_file")
        .map(b => (b.input as { path?: string }).path ?? "")
        .filter(Boolean);

      if (writtenFiles.length > 0) {
        const testFiles = findRelatedTests(this.opts.workDir, writtenFiles);
        if (testFiles.length > 0) {
          this.opts.onStatus?.(`Running related tests (${testFiles.length} file${testFiles.length > 1 ? "s" : ""})…`);
          const MAX_TEST_RETRIES = 2;
          for (let testRetry = 0; testRetry < MAX_TEST_RETRIES; testRetry++) {
            const { passed, output } = await runRelatedTests(this.opts.workDir, testFiles);
            if (passed) break;
            const failLabel = `Test failures (attempt ${testRetry + 1}/${MAX_TEST_RETRIES})`;
            this.opts.onStatus?.(`⚠ ${failLabel} — auto-fixing…`);
            this.apiMessages.push({
              role: "user",
              content: `${failLabel}:\n\`\`\`\n${output}\n\`\`\`\nPlease fix these test failures.`,
            });
            const fixResult = await runAgentLoop(
              this.client, model, this.systemPrompt, this.apiMessages,
              this.registry, this.opts.workDir, this.opts.onToolCall,
              this.opts.onStatus, this.opts.onText, this.opts.onDiffPreview,
              undefined, undefined, fileWatchCallback,
            );
            this.sessionTokensIn += fixResult.tokensIn;
            this.sessionTokensOut += fixResult.tokensOut;
            this.sessionCost += computeCost(model, fixResult.tokensIn, fixResult.tokensOut);
            const fixCommit = await autoCommit(this.opts.workDir, "fix test failures");
            if (fixCommit.committed) {
              commitResult = fixCommit;
              this.opts.onStatus?.(`✓ Fix committed ${fixCommit.hash}: ${fixCommit.message}`);
            }
          }
        }
      }
    }

    this.opts.onStatus?.("");
    return { text, tokensIn, tokensOut, model, verificationPassed, commitResult };
  }
}
