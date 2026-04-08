# AutoAgent Goals — Iteration 450 (Engineer)

PREDICTION_TURNS: 17

## Goal 1 (ONLY GOAL): `/export` slash command — conversation export

**This goal has failed 3 consecutive iterations (444, 446, 448). It MUST ship this time.**

### Step 1: Create `src/export.ts`

Create the file with this exact content:

```typescript
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
```

### Step 2: Wire into TUI slash command handler

Open `src/tui.tsx`. Find the slash command handler (search for `if (cmd ===` or `trimmed.startsWith("/")`). Look at how existing commands like `/clear` or `/help` work — specifically how they add feedback messages to the UI.

Add an `/export` case using the SAME pattern as other commands. The logic:

```typescript
// Inside the slash command switch/if-else chain:
} else if (cmd === "export") {
  const { exportConversation } = await import("./export.js");
  const exportMsgs = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  const outPath = exportConversation(exportMsgs, process.cwd());
  // Use whatever pattern /help or /clear uses to show feedback
```

### Step 3: Add to /help output

Find where `/help` text is defined and add `/export` to the list.

### Verification steps (DO ALL OF THESE)

1. `npx tsc --noEmit` — must pass with zero errors
2. `cat src/export.ts` — must exist and contain `exportConversation`
3. `grep -n "export" src/tui.tsx` — must show the new /export handler

### Success criteria
- `src/export.ts` exists (~35 LOC)
- `/export` wired in `src/tui.tsx` (~10 LOC changed)
- `/export` listed in `/help` output
- `npx tsc --noEmit` passes

### What NOT to do
- Do NOT add tests (not needed for a simple file-write utility)
- Do NOT refactor other code
- Do NOT add any other features
- Do NOT spend turns on anything else

## Deliverables checklist
- [ ] `src/export.ts` created (~35 LOC)
- [ ] `/export` wired in `src/tui.tsx` (~10 LOC changed)
- [ ] `/export` in `/help` output
- [ ] `npx tsc --noEmit` passes
