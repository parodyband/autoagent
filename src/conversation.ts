/**
 * Conversation loop — the core turn-by-turn agent interaction.
 *
 * Extracted from agent.ts to reduce complexity. Handles:
 * - Tool dispatch (with caching, timing, smart invalidation)
 * - Turn processing (API call → tool execution → restart detection)
 * - Budget warnings and turn-limit nudges
 *
 * Agent.ts creates the context and delegates here.
 */

import Anthropic from "@anthropic-ai/sdk";
import { validateBeforeCommit } from "./validation.js";
import {
  buildSystemPrompt,
  budgetWarning,
  progressCheckpoint,
  turnLimitNudge,
  validationBlockedMessage,
  type CognitiveMetrics,
} from "./messages.js";
import type { IterationState } from "./iteration.js";
import type { ToolCache } from "./tool-cache.js";
import type { ToolTimingTracker } from "./tool-timing.js";
import type { Logger } from "./logging.js";
import type { ToolRegistry } from "./tool-registry.js";
import { compressMessages, type CompressionConfig, DEFAULT_COMPRESSION_CONFIG } from "./context-compression.js";
import { dynamicBudgetWarning, type TurnBudget } from "./turn-budget.js";

// ─── Types ──────────────────────────────────────────────────

export interface IterationCtx {
  client: Anthropic;
  model: string;
  maxTokens: number;
  state: IterationState;
  iter: number;
  messages: Anthropic.MessageParam[];
  toolCounts: Record<string, number>;
  tokens: { in: number; out: number; cacheCreate: number; cacheRead: number };
  startTime: Date;
  turns: number;
  cache: ToolCache;
  timing: ToolTimingTracker;
  rootDir: string;
  maxTurns: number;
  predictedTurns?: number | null;
  /** Adaptive turn budget computed from historical metrics */
  turnBudget?: TurnBudget;
  logger: Logger;
  registry: ToolRegistry;
  log: (msg: string) => void;
  onFinalize: (ctx: IterationCtx, doRestart: boolean) => Promise<void>;
  /** Optional validator injection for testing. Defaults to validateBeforeCommit. */
  validate?: (rootDir: string, log: (msg: string) => void) => Promise<{ ok: boolean; output: string }>;
  /** Optional compression config. Set to null to disable compression. */
  compressionConfig?: CompressionConfig | null;
}

export type TurnResult = "continue" | "break" | "restarted";

// ─── Tool dispatch ──────────────────────────────────────────

/**
 * Handle a single tool call: check cache, execute, record timing,
 * update cache, smart-invalidate on writes.
 */
export async function handleToolCall(
  ctx: IterationCtx,
  toolUse: { type: "tool_use"; id: string; name: string; input: Record<string, unknown> },
): Promise<{ result: string; isRestart: boolean }> {
  ctx.toolCounts[toolUse.name] = (ctx.toolCounts[toolUse.name] || 0) + 1;

  const tool = ctx.registry.get(toolUse.name);
  if (!tool) {
    return { result: `Unknown tool: ${toolUse.name}`, isRestart: false };
  }

  // Check cache for idempotent tools
  const cached = ctx.cache.get(toolUse.name, toolUse.input);
  if (cached !== undefined) {
    ctx.log(`${toolUse.name}: CACHE HIT`);
    return { result: cached, isRestart: false };
  }

  const toolCtx = {
    rootDir: ctx.rootDir,
    log: ctx.log,
    defaultTimeout: tool.defaultTimeout,
  };

  const startMs = Date.now();
  try {
    const { result, isRestart } = await tool.handler(toolUse.input, toolCtx);
    const durationMs = Date.now() - startMs;
    ctx.timing.record(toolUse.name, durationMs);

    // Cache the result for idempotent tools
    ctx.cache.set(toolUse.name, toolUse.input, result);

    // Smart invalidation: only clear entries affected by written file
    if (toolUse.name === "write_file") {
      const writtenPath = toolUse.input.path as string;
      if (writtenPath) {
        ctx.cache.invalidateForPath(writtenPath);
      } else {
        ctx.cache.invalidate();
      }
    }
    return { result, isRestart: isRestart || false };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    ctx.timing.record(toolUse.name, durationMs);
    const errMsg = err instanceof Error ? err.message : String(err);
    ctx.log(`TOOL ERROR (${toolUse.name}): ${errMsg}`);
    return { result: `Error executing ${toolUse.name}: ${errMsg}`, isRestart: false };
  }
}

// ─── Turn processing ────────────────────────────────────────

/**
 * Process a single turn: API call → tool dispatch → restart/budget handling.
 */
/**
 * Add cache_control breakpoint to the last tool definition.
 * Anthropic caches everything up to (and including) the marked block.
 * Marking the last tool means the full tools array is cached.
 */
export function addCacheBreakpoint(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  if (tools.length === 0) return tools;
  const result = tools.map((t, i) =>
    i === tools.length - 1
      ? { ...t, cache_control: { type: "ephemeral" as const } }
      : t
  );
  return result;
}

/**
 * Add cache_control breakpoint to the last user message.
 * This caches the full conversation history up to the current turn,
 * so the next turn only pays for the new assistant+user messages.
 */
export function addMessageCacheBreakpoint(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages;
  // Find the last user message
  const lastUserIdx = messages.reduce((acc, m, i) => m.role === "user" ? i : acc, -1);
  if (lastUserIdx === -1) return messages;

  return messages.map((m, i) => {
    if (i !== lastUserIdx) return m;
    // Add cache_control to the last content block of the last user message
    const content = m.content;
    if (typeof content === "string") {
      return {
        ...m,
        content: [{
          type: "text" as const,
          text: content,
          cache_control: { type: "ephemeral" as const },
        }],
      };
    }
    if (Array.isArray(content) && content.length > 0) {
      const blocks = [...content];
      const lastBlock = { ...blocks[blocks.length - 1] };
      (lastBlock as Record<string, unknown>).cache_control = { type: "ephemeral" as const };
      blocks[blocks.length - 1] = lastBlock;
      return { ...m, content: blocks };
    }
    return m;
  });
}

export async function processTurn(ctx: IterationCtx): Promise<TurnResult> {
  ctx.turns++;
  const turnsLeft = ctx.maxTurns - ctx.turns;
  ctx.logger.setTurn(ctx.turns);
  ctx.log(`Turn ${ctx.turns}/${ctx.maxTurns}`);

  // Compress conversation context if it exceeds threshold
  if (ctx.compressionConfig !== null) {
    const compressionCfg = ctx.compressionConfig ?? DEFAULT_COMPRESSION_CONFIG;
    const { messages: compressed, compressed: didCompress, removedCount } = compressMessages(ctx.messages, compressionCfg);
    if (didCompress) {
      ctx.log(`Context compressed: ${ctx.messages.length} → ${compressed.length} messages (${removedCount} summarized)`);
      ctx.messages = compressed;
    }
  }

  const response = await ctx.client.messages.create({
    model: ctx.model,
    max_tokens: ctx.maxTokens,
    system: [{
      type: "text" as const,
      text: buildSystemPrompt(ctx.state, ctx.rootDir),
      cache_control: { type: "ephemeral" as const },
    }],
    tools: addCacheBreakpoint(ctx.registry.getDefinitions()),
    messages: addMessageCacheBreakpoint(ctx.messages),
  });

  // Track tokens
  if (response.usage) {
    ctx.tokens.in += response.usage.input_tokens;
    ctx.tokens.out += response.usage.output_tokens;
    const usage = response.usage as unknown as Record<string, unknown>;
    if (typeof usage.cache_creation_input_tokens === "number") ctx.tokens.cacheCreate += usage.cache_creation_input_tokens;
    if (typeof usage.cache_read_input_tokens === "number") ctx.tokens.cacheRead += usage.cache_read_input_tokens;
  }

  const content = response.content;
  ctx.messages.push({ role: "assistant", content });

  for (const block of content) {
    if (block.type === "text") {
      ctx.log(`Agent: ${block.text.slice(0, 400)}${block.text.length > 400 ? "..." : ""}`);
    }
  }

  const toolUses = content.filter(
    (b): b is Anthropic.ContentBlockParam & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use"
  );

  if (toolUses.length === 0) {
    // Check if the agent wrote the restart command in text instead of a tool call
    const textContent = content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (textContent.includes("AUTOAGENT_RESTART")) {
      ctx.log("Restart signal found in text (not tool call) — treating as restart");
      const validator = ctx.validate ?? validateBeforeCommit;
      const v = await validator(ctx.rootDir, ctx.log);
      if (!v.ok) {
        ctx.log("VALIDATION BLOCKED RESTART — asking agent to fix");
        ctx.messages.push({ role: "user", content: validationBlockedMessage(v.output) });
        return "continue";
      }
      await ctx.onFinalize(ctx, true);
      return "restarted";
    }

    ctx.log("No tool calls — ending");
    return "break";
  }

  // Execute independent tools concurrently
  const toolResults = await Promise.all(
    toolUses.map(async (tu) => {
      const { result, isRestart } = await handleToolCall(ctx, tu);
      return { id: tu.id, result, isRestart };
    })
  );

  const results: Anthropic.ToolResultBlockParam[] = [];
  let shouldRestart = false;
  for (const tr of toolResults) {
    results.push({ type: "tool_result", tool_use_id: tr.id, content: tr.result });
    if (tr.isRestart) shouldRestart = true;
  }
  ctx.messages.push({ role: "user", content: results });

  if (shouldRestart) {
    const doValidate = ctx.validate ?? validateBeforeCommit;
    const v = await doValidate(ctx.rootDir, ctx.log);
    if (!v.ok) {
      ctx.log("VALIDATION BLOCKED RESTART — agent must fix");
      ctx.messages.push({ role: "user", content: validationBlockedMessage(v.output) });
      return "continue";
    }

    await ctx.onFinalize(ctx, true);
    return "restarted";
  }

  if (response.stop_reason === "end_turn") {
    ctx.log("end_turn");
    return "break";
  }

  // Token budget awareness
  const bw = budgetWarning(ctx.turns, ctx.maxTurns, {
    inputTokens: ctx.tokens.in,
    outputTokens: ctx.tokens.out,
    cacheReadTokens: ctx.tokens.cacheRead,
    elapsedMs: Date.now() - ctx.startTime.getTime(),
  });
  if (bw) ctx.messages.push({ role: "user", content: bw });

  // Compute cognitive metrics for progress checkpoint
  const READ_TOOLS = new Set(["read_file", "grep", "list_files", "web_fetch"]);
  const WRITE_TOOLS = new Set(["write_file"]);
  let readCalls = 0, writeCalls = 0, totalCalls = 0;
  for (const [name, count] of Object.entries(ctx.toolCounts)) {
    totalCalls += count;
    if (READ_TOOLS.has(name)) readCalls += count;
    if (WRITE_TOOLS.has(name)) writeCalls += count;
  }
  const cogMetrics: CognitiveMetrics = {
    inputTokens: ctx.tokens.in,
    outputTokens: ctx.tokens.out,
    readCalls,
    writeCalls,
    totalCalls,
    turns: ctx.turns,
  };
  const checkpoint = progressCheckpoint(ctx.turns, cogMetrics);
  if (checkpoint) ctx.messages.push({ role: "user", content: checkpoint });

  const nudge = turnLimitNudge(turnsLeft);
  if (nudge) ctx.messages.push({ role: "user", content: nudge });

  // Adaptive budget warning — closed feedback loop from metrics → behavior
  if (ctx.turnBudget) {
    const budgetMsg = dynamicBudgetWarning(ctx.turns, ctx.turnBudget);
    if (budgetMsg) ctx.messages.push({ role: "user", content: budgetMsg });
  }

  return "continue";
}

// ─── Conversation loop ─────────────────────────────────────

/**
 * Run the full conversation loop until completion, restart, or turn limit.
 */
export async function runConversation(ctx: IterationCtx): Promise<void> {
  // Hard turn cap: if predicted turns exist, cap at 1.5x prediction.
  // This makes scope overruns structurally impossible rather than advisory.
  const hardCap = ctx.predictedTurns
    ? Math.min(Math.ceil(ctx.predictedTurns * 1.5), ctx.maxTurns)
    : ctx.maxTurns;

  if (hardCap < ctx.maxTurns && ctx.predictedTurns) {
    ctx.log(`Hard turn cap: ${hardCap} (1.5x prediction of ${ctx.predictedTurns})`);
  }

  while (ctx.turns < hardCap) {
    const result = await processTurn(ctx);
    if (result === "restarted") return; // already finalized + restarted
    if (result === "break") {
      ctx.log("Agent stopped — committing and restarting");
      await ctx.onFinalize(ctx, true);
      return;
    }
  }

  if (ctx.predictedTurns && hardCap < ctx.maxTurns) {
    ctx.log(`HARD TURN CAP REACHED: ${ctx.turns} turns (predicted ${ctx.predictedTurns}, cap ${hardCap}). Forcing commit.`);
  } else {
    ctx.log("Hit max turns — committing and restarting");
  }
  await ctx.onFinalize(ctx, true);
}
