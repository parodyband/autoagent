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
import { fingerprintRepo } from "./repo-context.js";
import { rankFiles } from "./file-ranker.js";
import { shouldDecompose, decomposeTasks, formatSubtasks } from "./task-decomposer.js";
import { runVerification, formatVerificationResults } from "./verification.js";
import { createDefaultRegistry } from "./tool-registry.js";

// ─── Constants ────────────────────────────────────────────────

const MODEL_COMPLEX = "claude-sonnet-4-6";
const MODEL_SIMPLE = "claude-haiku-4-5";
const MAX_TOKENS = 16384;
const MAX_ROUNDS = 30;

/** Token threshold at which we trigger context compaction (~150K). */
const COMPACT_THRESHOLD = 150_000;

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

export interface OrchestratorOptions {
  workDir: string;
  /** Called when a tool is invoked */
  onToolCall?: (name: string, input: string, result: string) => void;
  /** Called with status updates (e.g. "Indexing repo...") */
  onStatus?: (status: string) => void;
  /** Called with streaming text deltas */
  onText?: (delta: string) => void;
}

export interface OrchestratorResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  verificationPassed?: boolean;
}

export interface CostInfo {
  cost: number;
  tokensIn: number;
  tokensOut: number;
}

// ─── Model routing ────────────────────────────────────────────

/**
 * Pick a model based on the user's request.
 * Simple read/explain tasks → haiku (fast, cheap).
 * Code changes or complex queries → sonnet.
 */
export function routeModel(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  const codeScore = CODE_CHANGE_KEYWORDS.filter(k => lower.includes(k)).length;
  const readScore = READ_ONLY_KEYWORDS.filter(k => lower.includes(k)).length;

  // Long messages are usually complex
  const isLong = userMessage.length > 300;

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
 */
export function buildSystemPrompt(workDir: string, repoFingerprint: string): string {
  const rankedFiles = rankFiles(workDir, 8);
  const fileList = rankedFiles.length > 0
    ? "\n\n## Key Files (ranked by importance)\n" +
      rankedFiles.map(f => `- ${f.path} (${f.reason})`).join("\n")
    : "";

  return `You are an expert coding assistant with direct access to the filesystem and shell.

Working directory: ${workDir}

You have these tools: bash, read_file, write_file, grep, web_search.

Rules:
- Be concise and action-oriented. Do the thing, show the result.
- Use bash for commands, read_file/write_file for files, grep for search.
- After making code changes, always verify with the appropriate test/build command.
- If you encounter an error, diagnose and fix it before giving up.
- Never ask for confirmation — just do it.

${repoFingerprint}${fileList}`;
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
) {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    const tool = registry.get(name);
    if (!tool) return `Unknown tool: ${name}`;

    const ctx = {
      rootDir: workDir,
      log: () => {},
      defaultTimeout: tool.defaultTimeout,
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
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const execTool = makeExecTool(registry, workDir, onToolCall, onStatus);
  const tools = registry.getDefinitions();

  let totalIn = 0, totalOut = 0;
  let fullText = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Use streaming API
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages: apiMessages,
    });

    // Accumulate tool_use inputs (arrive as JSON deltas)
    const toolInputBuffers: Record<string, string> = {};

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          toolInputBuffers[event.index] = "";
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          onText?.(event.delta.text);
          fullText += event.delta.text;
        } else if (event.delta.type === "input_json_delta") {
          toolInputBuffers[event.index] = (toolInputBuffers[event.index] ?? "") + event.delta.partial_json;
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    totalIn += finalMessage.usage?.input_tokens ?? 0;
    totalOut += finalMessage.usage?.output_tokens ?? 0;
    apiMessages.push({ role: "assistant", content: finalMessage.content });

    const toolUses = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const result = await execTool(tu.name, tu.input as Record<string, unknown>);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    apiMessages.push({ role: "user", content: results });

    if (finalMessage.stop_reason === "end_turn") break;
  }

  return { text: fullText, tokensIn: totalIn, tokensOut: totalOut };
}

// ─── Orchestrator class ───────────────────────────────────────

export class Orchestrator {
  private client: Anthropic;
  private registry: ReturnType<typeof createDefaultRegistry>;
  private repoFingerprint: string = "";
  private systemPrompt: string = "";
  private apiMessages: Anthropic.MessageParam[] = [];
  private opts: OrchestratorOptions;
  private initialized = false;

  // Cost tracking
  private sessionTokensIn = 0;
  private sessionTokensOut = 0;
  private sessionCost = 0;

  constructor(opts: OrchestratorOptions) {
    this.opts = opts;
    this.client = new Anthropic();
    this.registry = createDefaultRegistry();
  }

  /** Initialize repo context (call once before first message). */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.opts.onStatus?.("Indexing repo...");
    this.repoFingerprint = fingerprintRepo(this.opts.workDir);
    this.systemPrompt = buildSystemPrompt(this.opts.workDir, this.repoFingerprint);
    this.initialized = true;
    this.opts.onStatus?.("");
  }

  /** Clear conversation history (but keep repo context). */
  clearHistory(): void {
    this.apiMessages = [];
    this.sessionTokensIn = 0;
    this.sessionTokensOut = 0;
    this.sessionCost = 0;
  }

  /** Re-index the repo (after significant changes). */
  reindex(): void {
    this.repoFingerprint = fingerprintRepo(this.opts.workDir);
    this.systemPrompt = buildSystemPrompt(this.opts.workDir, this.repoFingerprint);
  }

  /** Get current session cost info. */
  getCost(): CostInfo {
    return {
      cost: this.sessionCost,
      tokensIn: this.sessionTokensIn,
      tokensOut: this.sessionTokensOut,
    };
  }

  /** Check if context compaction is needed. */
  private shouldCompact(): boolean {
    return this.sessionTokensIn >= COMPACT_THRESHOLD;
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
      `Summarize this conversation concisely, preserving key decisions, file paths, and results:\n\n${convText}`
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

    // 1. Model routing
    const model = routeModel(userMessage);
    this.opts.onStatus?.(`Using ${model === MODEL_COMPLEX ? "Sonnet" : "Haiku"}...`);

    // 2. Context compaction if needed
    if (this.shouldCompact()) {
      await this.compact();
    }

    // 3. Task decomposition for complex tasks
    let effectiveMessage = userMessage;
    if (shouldDecompose(userMessage)) {
      this.opts.onStatus?.("Decomposing task...");
      const caller = makeSimpleCaller(this.client);
      const subtasks = await decomposeTasks(userMessage, caller);
      if (subtasks.length > 1) {
        const decomposition = formatSubtasks(subtasks);
        effectiveMessage = `${userMessage}\n\n${decomposition}`;
      }
    }

    // 4. Add user message to history
    this.apiMessages.push({ role: "user", content: effectiveMessage });

    this.opts.onStatus?.("Thinking...");

    // 5. Run streaming agent loop
    const { text, tokensIn, tokensOut } = await runAgentLoop(
      this.client,
      model,
      this.systemPrompt,
      this.apiMessages,
      this.registry,
      this.opts.workDir,
      this.opts.onToolCall,
      this.opts.onStatus,
      this.opts.onText,
    );

    // Accumulate cost
    this.sessionTokensIn += tokensIn;
    this.sessionTokensOut += tokensOut;
    this.sessionCost += computeCost(model, tokensIn, tokensOut);

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
          );
        }
      }
    }

    this.opts.onStatus?.("");
    return { text, tokensIn, tokensOut, model, verificationPassed };
  }
}
