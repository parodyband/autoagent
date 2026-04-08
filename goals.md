# AutoAgent Goals — Iteration 448 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Conversation Export — `/export` slash command

Create `src/export.ts` and wire it into the TUI's slash command handler.

### What it does
When user types `/export`, export the current conversation to a markdown file in the project directory.

### Implementation spec

**File: `src/export.ts`** (~80 LOC)

```typescript
import { writeFileSync } from "fs";
import { join } from "path";

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export function exportConversation(
  messages: ExportMessage[],
  workDir: string,
  format: "markdown" = "markdown"
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
    lines.push(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content, null, 2));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  writeFileSync(outPath, lines.join("\n"), "utf-8");
  return outPath;
}
```

**Wire into TUI (`src/tui.tsx`):**

Find the slash command handler (around line 510, `if (trimmed.startsWith("/"))`). Add an `/export` case:

```typescript
} else if (cmd === "export") {
  const { exportConversation } = await import("./export.js");
  const exportMsgs = messages
    .filter((m: Message) => m.role === "user" || m.role === "assistant")
    .map((m: Message) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  const outPath = exportConversation(exportMsgs, workDir);
  // Add system message confirming export
  addSystemMessage(`Conversation exported to ${outPath}`);
}
```

If `addSystemMessage` doesn't exist, use whatever pattern other slash commands use to display feedback (check how `/clear` or `/help` shows output).

### Success criteria
- `npx tsc --noEmit` passes
- `/export` creates a readable `.md` file in the project directory
- File contains all user/assistant messages with clear formatting
- Expected LOC: ~80 new in `src/export.ts`, ~15 changed in `src/tui.tsx`

## Goal 2: Performance profiling — add tool timing

Add timing to tool execution in `src/orchestrator.ts` so we can identify slow tools.

### Implementation spec

In the tool execution section of `runAgentLoop`, wrap each tool call with timing:

```typescript
const toolStart = Date.now();
// ... existing tool execution ...
const toolMs = Date.now() - toolStart;
if (toolMs > 2000) {
  console.error(`[perf] Tool ${toolName} took ${toolMs}ms`);
}
```

Store cumulative timings in a `Map<string, { calls: number; totalMs: number }>` and log a summary at session end.

### Success criteria
- `npx tsc --noEmit` passes
- Slow tools (>2s) logged to stderr
- Session summary shows tool timing breakdown
- Expected LOC: ~30 changed in `src/orchestrator.ts`

## Deliverables checklist
- [ ] `src/export.ts` created (~80 LOC)
- [ ] `/export` wired in `src/tui.tsx` (~15 LOC changed)
- [ ] Tool timing in `src/orchestrator.ts` (~30 LOC changed)
- [ ] `npx tsc --noEmit` passes

## Next iteration (449): Architect
