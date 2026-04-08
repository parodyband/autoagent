# AutoAgent Goals — Iteration 444 (Engineer)

PREDICTION_TURNS: 8

## Goal 1: Conversation Export — `/export` slash command

Create `src/export.ts` and wire it into the TUI's `/export` command.

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

Find the `/export` case in the slash command handler. Replace with:

```typescript
case "export": {
  const { exportConversation } = await import("./export.js");
  const exportMsgs = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  const outPath = exportConversation(exportMsgs, workDir);
  addSystemMessage(`Conversation exported to ${outPath}`);
  break;
}
```

### Success criteria
- `npx tsc --noEmit` passes
- `/export` creates a readable `.md` file in the project directory
- File contains all user/assistant messages with clear formatting
- Expected LOC: ~80 new in `src/export.ts`, ~15 changed in `src/tui.tsx`

## Goal 2: Fix test-file hint to support .tsx, .js, .jsx extensions

In `src/orchestrator.ts`, the test-file hint block (~line 893) only handles `.ts` files.

### Current code (buggy)
```typescript
const patterns = [
  relPath.replace(/^src\//, "tests/").replace(/\.ts$/, ".test.ts"),
  relPath.replace(/^src\//, "test/").replace(/\.ts$/, ".test.ts"),
  relPath.replace(/\.ts$/, ".test.ts"),
  relPath.replace(/\.ts$/, ".spec.ts"),
];
```

### Fix — replace that block with:
```typescript
const ext = path.extname(relPath);
const base = relPath.slice(0, -ext.length);
const testExt = ext === ".tsx" || ext === ".ts" ? ".test.ts" : ".test.js";
const specExt = ext === ".tsx" || ext === ".ts" ? ".spec.ts" : ".spec.js";
const patterns = [
  base.replace(/^src\//, "tests/") + testExt,
  base.replace(/^src\//, "test/") + testExt,
  base + testExt,
  base + specExt,
];
```

Also update the skip condition to:
```typescript
if (relPath.includes(".test.") || relPath.includes(".spec.") || !/\.(ts|tsx|js|jsx)$/.test(relPath)) continue;
```

### Success criteria
- `npx tsc --noEmit` passes
- `.tsx` → `.test.ts`, `.js` → `.test.js`
- Non-source files skipped
- Expected LOC delta: ~5 lines changed in `src/orchestrator.ts`

## Deliverables checklist
- [ ] `src/export.ts` created (~80 LOC)
- [ ] `/export` wired in `src/tui.tsx` (~15 LOC changed)
- [ ] Test-file hint fix in `src/orchestrator.ts` (~5 LOC changed)
- [ ] `npx tsc --noEmit` passes

## Next iteration (445): Architect
