/**
 * Interactive CLI — talk to the autoagent's tool system directly.
 *
 * Usage:
 *   npx tsx src/cli.ts                    # work in current directory
 *   npx tsx src/cli.ts --dir /path/to/repo  # work in a specific repo
 *
 * This is separate from the self-improvement loop. It uses the same
 * tool registry but doesn't touch memory, goals, metrics, or state.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { createDefaultRegistry } from "./tool-registry.js";
import { runInit } from "./init-command.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16384;

// ─── Parse args ─────────────────────────────────────────────

let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
}

// ─── /help subcommand ────────────────────────────────────────
export function printHelp(): void {
  // Read version from package.json if available
  let version = "unknown";
  try {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    if (pkg.version) version = pkg.version;
  } catch { /* ignore */ }

  console.log(`
\x1b[1mAutoAgent\x1b[0m v${version}
An AI coding agent that's better than talking to Claude directly.

\x1b[1mUSAGE\x1b[0m
  autoagent              Start the interactive TUI
  autoagent init         Scaffold .autoagent.md project config
  autoagent help         Show this help message

\x1b[1mCLI SUBCOMMANDS\x1b[0m
  init                   Analyze repo and generate/update .autoagent.md
  help                   Print this help and exit

\x1b[1mTUI SLASH COMMANDS\x1b[0m
  /help                  Show available commands
  /clear                 Clear conversation history
  /init                  Scaffold .autoagent.md for current project
  /diff                  Show git diff of recent changes
  /undo                  Undo the last auto-commit
  /find <query>          Search the codebase for files/symbols
  /model [name]          Show or switch the active model
  /status                Show project status (git, diagnostics)
  /rewind [n]            Rewind conversation to a previous checkpoint
  /exit                  Exit and auto-export session log
  /export [file]         Export session to a markdown file
  /resume                Resume a previous session
  /reindex               Rebuild the repo symbol index
  /compact               Compact conversation history to save tokens

\x1b[1mEXAMPLES\x1b[0m
  autoagent              # Start chatting with the agent
  autoagent init         # Set up .autoagent.md for your project
  autoagent --dir ./app  # Work in a specific directory
`.trim());
}

if (process.argv[2] === "help") {
  printHelp();
  process.exit(0);
}

// ─── /init subcommand ────────────────────────────────────────
if (process.argv[2] === "init") {
  try {
    const result = await runInit(workDir, (msg) => console.log(`  ${msg}`));
    if (result.updated) {
      console.log("\n✓ Updated .autoagent.md\n");
    } else {
      console.log("\n✓ Created .autoagent.md\n");
    }
    console.log(result.content);
    process.exit(0);
  } catch (err) {
    console.error("Error running init:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// ─── Setup ──────────────────────────────────────────────────

const client = new Anthropic();
const registry = createDefaultRegistry();
const tools = registry.getDefinitions();
const messages: Anthropic.MessageParam[] = [];

const systemPrompt = `You are a coding assistant with direct access to the filesystem and shell.

Working directory: ${workDir}

You have these tools: ${registry.getNames().join(", ")}

Rules:
- Be concise. Do the thing, show the result.
- ESM/TypeScript project conventions: import not require, .js extensions in imports.
- Use bash for commands, read_file/write_file for files, grep for search.
- If the user asks you to do something, do it. Don't ask for confirmation.`;

// ─── Tool dispatch ──────────────────────────────────────────

async function handleTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const tool = registry.get(name);
  if (!tool) return `Unknown tool: ${name}`;

  const ctx = {
    rootDir: workDir,
    log: (msg: string) => process.stderr.write(`  ${msg}\n`),
    defaultTimeout: tool.defaultTimeout,
  };

  try {
    const { result } = await tool.handler(input, ctx);
    return result;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : err}`;
  }
}

// ─── Conversation turn ──────────────────────────────────────

async function runTurn(): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    tools,
    messages,
  });

  const content = response.content;
  messages.push({ role: "assistant", content });

  // Collect text output
  let textOutput = "";
  for (const block of content) {
    if (block.type === "text" && block.text.trim()) {
      textOutput += block.text;
    }
  }

  // Check for tool use
  const toolUses = content.filter(
    (b): b is Anthropic.ContentBlockParam & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use"
  );

  if (toolUses.length === 0) {
    return textOutput;
  }

  // Execute tools
  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const tu of toolUses) {
    process.stderr.write(`  \x1b[90m${tu.name}: ${JSON.stringify(tu.input).slice(0, 100)}\x1b[0m\n`);
    const result = await handleTool(tu.name, tu.input);
    // Show truncated result
    const preview = result.split("\n").slice(0, 3).join("\n");
    if (preview.length > 200) {
      process.stderr.write(`  \x1b[90m→ ${preview.slice(0, 200)}...\x1b[0m\n`);
    } else if (preview) {
      process.stderr.write(`  \x1b[90m→ ${preview}\x1b[0m\n`);
    }
    results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
  }

  messages.push({ role: "user", content: results });

  // Continue the conversation (model may want to use more tools or respond)
  return (textOutput ? textOutput + "\n" : "") + await runTurn();
}

// ─── REPL ───────────────────────────────────────────────────

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`\x1b[1mAutoAgent CLI\x1b[0m — ${MODEL}`);
console.log(`Working directory: ${workDir}`);
console.log(`Tools: ${registry.getNames().join(", ")}`);
console.log(`Type your request. Ctrl+C to exit.\n`);

function prompt() {
  rl.question("\x1b[36m> \x1b[0m", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) { prompt(); return; }

    if (trimmed === "/clear") {
      messages.length = 0;
      console.log("Conversation cleared.\n");
      prompt();
      return;
    }

    if (trimmed === "/cost") {
      // rough token estimate from message sizes
      const chars = JSON.stringify(messages).length;
      console.log(`~${Math.round(chars / 4)} tokens in conversation history\n`);
      prompt();
      return;
    }

    messages.push({ role: "user", content: trimmed });

    try {
      const response = await runTurn();
      if (response) {
        console.log(`\n${response}\n`);
      } else {
        console.log();
      }
    } catch (err) {
      console.error(`\x1b[31mError: ${err instanceof Error ? err.message : err}\x1b[0m\n`);
    }

    prompt();
  });
}

prompt();
