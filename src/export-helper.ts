import { writeFileSync, mkdirSync } from "fs";
import path from "path";

export interface ExportStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build and write a markdown export of the conversation.
 * Strips tool-call JSON lines from assistant messages.
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
  const { tokensIn, tokensOut, cost } = stats;
  const lines: string[] = [
    `# AutoAgent Conversation Export`,
    ``,
    `**Date**: ${now.toLocaleString()}`,
    `**Model**: ${model}`,
    `**Project**: ${projectName}`,
    ``,
    `---`,
    ``,
  ];
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`## User`, ``, msg.content, ``);
    } else {
      const textContent = msg.content
        .split("\n")
        .filter(l => !l.startsWith('{"type":"tool'))
        .join("\n")
        .trim();
      if (textContent) {
        lines.push(`## Assistant`, ``, textContent, ``);
      }
    }
  }
  lines.push(
    `---`,
    ``,
    `## Session Summary`,
    ``,
    `- **Tokens in**: ${tokensIn.toLocaleString()}`,
    `- **Tokens out**: ${tokensOut.toLocaleString()}`,
    `- **Total cost**: ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`,
    ``,
  );
  writeFileSync(filePath, lines.join("\n"), "utf-8");
}
