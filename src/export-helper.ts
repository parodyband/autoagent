import { writeFileSync, mkdirSync } from "fs";
import path from "path";

export interface ExportStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  turnCount?: number;
  durationMs?: number;
}

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Tool call extraction ──────────────────────────────────────

interface ToolCallBlock {
  toolName: string;
  input: string;
  result?: string;
}

/**
 * Extract tool calls from an assistant message content string.
 * Tool call lines look like: {"type":"tool_use","name":"bash","input":{...}}
 * Tool result lines look like: {"type":"tool_result","tool_use_id":"...","content":"..."}
 */
function extractToolCalls(content: string): { text: string; toolCalls: ToolCallBlock[] } {
  const lines = content.split("\n");
  const textLines: string[] = [];
  const toolCalls: ToolCallBlock[] = [];
  const pendingByName = new Map<string, ToolCallBlock>();

  for (const line of lines) {
    if (!line.startsWith('{"type":"tool')) {
      textLines.push(line);
      continue;
    }
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj["type"] === "tool_use") {
        const name = (obj["name"] as string) ?? "unknown";
        const input = JSON.stringify(obj["input"] ?? {}, null, 2);
        const block: ToolCallBlock = { toolName: name, input };
        toolCalls.push(block);
        pendingByName.set(name, block);
      } else if (obj["type"] === "tool_result") {
        // Try to match to last pending tool call
        const content2 = obj["content"];
        const resultStr = typeof content2 === "string"
          ? content2
          : JSON.stringify(content2);
        // Attach to the last tool call that doesn't have a result yet
        for (let i = toolCalls.length - 1; i >= 0; i--) {
          if (!toolCalls[i].result) {
            toolCalls[i].result = resultStr;
            break;
          }
        }
      }
    } catch {
      textLines.push(line);
    }
  }

  return { text: textLines.join("\n").trim(), toolCalls };
}

/**
 * Render a tool call as a collapsible <details> block.
 */
function renderToolCall(tc: ToolCallBlock): string {
  const lines: string[] = [
    `<details>`,
    `<summary>🔧 <code>${tc.toolName}</code></summary>`,
    ``,
    `**Input:**`,
    `\`\`\`json`,
    tc.input,
    `\`\`\``,
  ];
  if (tc.result !== undefined) {
    // Truncate very long results
    const resultStr = tc.result.length > 2000
      ? tc.result.slice(0, 2000) + "\n…(truncated)"
      : tc.result;
    lines.push(``, `**Result:**`, `\`\`\``, resultStr, `\`\`\``);
  }
  lines.push(``, `</details>`);
  return lines.join("\n");
}

// ─── Table of contents ─────────────────────────────────────────

/**
 * Build a GitHub-flavoured anchor slug from a heading string.
 */
function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Build a markdown table of contents from user messages.
 * Each entry links to the corresponding heading anchor.
 */
function buildTOC(userMessages: Array<{ index: number; preview: string }>): string {
  const lines = [`## Table of Contents`, ``];
  for (const { index, preview } of userMessages) {
    const heading = `User Message ${index}`;
    const anchor = toAnchor(heading);
    const truncated = preview.length > 60 ? preview.slice(0, 57) + "…" : preview;
    lines.push(`${index}. [${truncated}](#${anchor})`);
  }
  return lines.join("\n");
}

// ─── Main export ───────────────────────────────────────────────

/**
 * Build and write a markdown export of the conversation.
 * Features:
 * - Table of contents linking to each user turn
 * - Horizontal rules separating conversation turns
 * - Tool calls rendered as collapsible <details> blocks
 */
export function buildExportContent(
  messages: ExportMessage[],
  model: string,
  stats: ExportStats,
  workDir: string,
  filePath: string,
): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const now = new Date();
  const projectName = path.basename(workDir);
  const { tokensIn, tokensOut, cost, turnCount, durationMs } = stats;

  // Collect user messages for TOC
  const userEntries: Array<{ index: number; preview: string }> = [];
  let userCount = 0;
  for (const msg of messages) {
    if (msg.role === "user") {
      userCount++;
      const firstLine = msg.content.split("\n")[0].trim();
      userEntries.push({ index: userCount, preview: firstLine || `Message ${userCount}` });
    }
  }

  const durationStr = durationMs !== undefined
    ? durationMs < 60_000
      ? `${(durationMs / 1000).toFixed(0)}s`
      : `${(durationMs / 60_000).toFixed(1)}m`
    : undefined;

  const lines: string[] = [
    `# AutoAgent Conversation Export`,
    ``,
    `**Date**: ${now.toLocaleString()}`,
    `**Model**: ${model}`,
    `**Project**: ${projectName}`,
    ...(turnCount !== undefined ? [`**Turns**: ${turnCount}`] : []),
    ...(durationStr !== undefined ? [`**Duration**: ${durationStr}`] : []),
    ``,
    `---`,
    ``,
  ];

  // Table of contents
  if (userEntries.length > 0) {
    lines.push(buildTOC(userEntries), ``, `---`, ``);
  }

  // Conversation turns
  let userIdx = 0;
  for (const msg of messages) {
    if (msg.role === "user") {
      userIdx++;
      const heading = `User Message ${userIdx}`;
      lines.push(`## ${heading}`, ``, msg.content, ``);
    } else {
      const { text, toolCalls } = extractToolCalls(msg.content);

      if (text || toolCalls.length > 0) {
        lines.push(`## Assistant`, ``);
        if (text) {
          lines.push(text, ``);
        }
        for (const tc of toolCalls) {
          lines.push(renderToolCall(tc), ``);
        }
      }
    }
    // Horizontal rule between turns
    lines.push(`---`, ``);
  }

  lines.push(
    `## Session Summary`,
    ``,
    `- **Tokens in**: ${tokensIn.toLocaleString()}`,
    `- **Tokens out**: ${tokensOut.toLocaleString()}`,
    `- **Total cost**: ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`,
    ``,
  );
  writeFileSync(filePath, lines.join("\n"), "utf-8");
}
