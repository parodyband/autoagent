import { writeFileSync } from "fs";
import { join } from "path";

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
}

export function exportConversation(
  messages: ExportMessage[],
  workDir: string,
): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `autoagent-chat-${ts}.md`;
  const outPath = join(workDir, filename);

  const lines: string[] = [
    `# AutoAgent Conversation — ${new Date().toISOString()}`,
    "",
  ];

  for (const msg of messages) {
    const label = msg.role === "user" ? "## 🧑 User" : "## 🤖 Assistant";
    lines.push(label);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  writeFileSync(outPath, lines.join("\n"), "utf-8");
  return outPath;
}
