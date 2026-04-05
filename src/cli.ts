/**
 * Interactive CLI — talk to the autoagent's tool system directly.
 *
 * Usage:
 *   npx tsx src/cli.ts                    # work in current directory
 *   npx tsx src/cli.ts --dir /path/to/repo  # work in a specific repo
 *
 * Powered by the Orchestrator — same pipeline as the TUI:
 *   streaming, compaction, repo map, context loading, model routing,
 *   abort, session stats, auto-commit, diagnostics, sub-agent delegation.
 */

import { createInterface } from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import "dotenv/config";
import { Orchestrator } from "./orchestrator.js";
import { runInit } from "./init-command.js";

// ─── Parse args ─────────────────────────────────────────────

let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
}

// ─── /help subcommand ────────────────────────────────────────
export function printHelp(): void {
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

// ─── Orchestrator setup ─────────────────────────────────────

let isResponding = false;

const orchestrator = new Orchestrator({
  workDir,

  // Stream text deltas to stdout
  onText: (delta: string) => {
    process.stdout.write(delta);
  },

  // Print status updates to stderr (dim)
  onStatus: (status: string) => {
    if (status) {
      process.stderr.write(`\x1b[90m  ${status}\x1b[0m\n`);
    }
  },

  // Print tool calls to stderr (dim)
  onToolCall: (name: string, input: string, result: string) => {
    const inputPreview = input.slice(0, 100);
    const resultPreview = result.split("\n").slice(0, 3).join("\n").slice(0, 200);
    process.stderr.write(`\x1b[90m  ${name}: ${inputPreview}\x1b[0m\n`);
    if (resultPreview) {
      process.stderr.write(`\x1b[90m  → ${resultPreview}\x1b[0m\n`);
    }
  },

  // Warn when approaching context limit
  onContextWarning: () => {
    process.stderr.write(
      `\x1b[33m  ⚠ Context approaching limit — compaction may occur\x1b[0m\n`
    );
  },
});

// ─── REPL ───────────────────────────────────────────────────

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`\x1b[1mAutoAgent CLI\x1b[0m — powered by Orchestrator`);
console.log(`Working directory: ${workDir}`);
console.log(`Type your request. /clear to reset, /cost for stats, Ctrl+C to exit.\n`);

// Handle Ctrl+C: abort current request if responding, else exit
process.on("SIGINT", () => {
  if (isResponding) {
    process.stderr.write("\x1b[33m  Aborting...\x1b[0m\n");
    orchestrator.abort();
  } else {
    console.log("\nGoodbye!");
    process.exit(0);
  }
});

function prompt() {
  rl.question("\x1b[36m> \x1b[0m", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) { prompt(); return; }

    // ─── Slash commands ──────────────────────────────────

    if (trimmed === "/clear") {
      orchestrator.clearHistory();
      console.log("Conversation cleared.\n");
      prompt();
      return;
    }

    if (trimmed === "/cost") {
      const stats = orchestrator.getSessionStats();
      const mins = Math.round(stats.durationMs / 60000);
      console.log(
        `Session: ${stats.turnCount} turn${stats.turnCount !== 1 ? "s" : ""}, ` +
        `${mins} min, ` +
        `avg ${stats.avgCostPerTurn.toFixed(4)}/turn, ` +
        `trend ${stats.costTrend}\n`
      );
      prompt();
      return;
    }

    if (trimmed === "/help") {
      console.log(
        "\nAvailable slash commands:\n" +
        "  /clear            Clear conversation history\n" +
        "  /cost             Show session cost stats\n" +
        "  /model [name]     Show or set model (sonnet/haiku/full model name)\n" +
        "  /status           Show session stats + git status\n" +
        "  /compact          Compact conversation history\n" +
        "  /reindex          Re-index repo map\n" +
        "  /help             Show this help\n"
      );
      prompt();
      return;
    }

    if (trimmed.startsWith("/model")) {
      const arg = trimmed.slice(6).trim();
      if (!arg) {
        const current = (orchestrator as unknown as { _modelOverride?: string })._modelOverride ?? "auto";
        console.log(`Current model: ${current}\n`);
      } else {
        // Expand shorthand: "sonnet" → full name, "haiku" → full name
        const modelMap: Record<string, string> = {
          sonnet: "claude-sonnet-4-6",
          haiku: "claude-haiku-4-5",
        };
        const resolved = modelMap[arg.toLowerCase()] ?? arg;
        orchestrator.setModel(resolved);
        console.log(`Model set to: ${resolved}\n`);
      }
      prompt();
      return;
    }

    if (trimmed === "/status") {
      const stats = orchestrator.getSessionStats();
      const mins = Math.round(stats.durationMs / 60000);
      console.log(
        `\nSession: ${stats.turnCount} turn${stats.turnCount !== 1 ? "s" : ""}, ` +
        `${mins} min, avg ${stats.avgCostPerTurn.toFixed(4)}/turn, trend ${stats.costTrend}`
      );
      try {
        const gitOut = execSync("git status --short", { cwd: workDir, encoding: "utf8" }).trim();
        console.log(`Git status:\n${gitOut || "  (clean)"}\n`);
      } catch {
        console.log("Git: not a git repo\n");
      }
      prompt();
      return;
    }

    if (trimmed === "/compact") {
      console.log("Compacting history...");
      await orchestrator.compactHistory();
      console.log("Done.\n");
      prompt();
      return;
    }

    if (trimmed === "/reindex") {
      console.log("Re-indexing repo map...");
      await orchestrator.reindexRepoMap();
      console.log("Done.\n");
      prompt();
      return;
    }

    if (trimmed === "/plan" || trimmed === "/plan resume" || trimmed.startsWith("/plan ")) {
      const {
        createPlan,
        formatPlan,
        executePlan,
        savePlan,
        loadPlan,
      } = await import("./task-planner.js");
      type TaskExecutor = import("./task-planner.js").TaskExecutor;

      // Build a shared executor that delegates to the orchestrator
      const makePlanExecutor = (): TaskExecutor => async (task) => {
        process.stdout.write(`\n\x1b[36m── Task [${task.id}]: ${task.title} ──\x1b[0m\n`);
        process.stdout.write(`\x1b[90m${task.description}\x1b[0m\n\n`);

        isResponding = true;
        try {
          const result = await orchestrator.send(task.description);
          if (result.text && !result.text.endsWith("\n")) process.stdout.write("\n");
          return result.text ?? "completed";
        } finally {
          isResponding = false;
        }
      };

      // ── /plan resume ────────────────────────────────────────
      if (trimmed === "/plan resume") {
        const plan = loadPlan(workDir);
        if (!plan) {
          console.log("No saved plan found. Run /plan <goal> first.\n");
          prompt();
          return;
        }
        const incomplete = plan.tasks.filter(
          (t) => t.status !== "done"
        );
        if (incomplete.length === 0) {
          console.log("Plan already complete.\n");
          console.log(formatPlan(plan) + "\n");
          prompt();
          return;
        }
        // Reset failed/in-progress tasks back to pending so they can retry
        for (const t of plan.tasks) {
          if (t.status === "failed" || t.status === "in-progress") {
            t.status = "pending";
            t.error = undefined;
          }
        }
        console.log(`Resuming plan: ${plan.goal}`);
        console.log(`${incomplete.length} task(s) remaining.\n`);
        try {
          await executePlan(plan, makePlanExecutor(), (task, updatedPlan) => {
            if (task.status === "in-progress") {
              // header already printed by executor
            } else if (task.status === "done") {
              process.stdout.write(`\x1b[32m✓ [${task.id}] Done: ${task.title}\x1b[0m\n`);
            } else if (task.status === "failed") {
              process.stdout.write(`\x1b[31m✗ [${task.id}] Failed: ${task.title} — ${task.error ?? ""}\x1b[0m\n`);
            }
            void updatedPlan;
          });
          savePlan(plan, workDir);
          console.log("\n" + formatPlan(plan) + "\n");
        } catch (err) {
          console.error(`Plan error: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        prompt();
        return;
      }

      // ── /plan <goal> ─────────────────────────────────────────
      const description = trimmed.slice(6).trim();
      if (!description) {
        console.log("Usage: /plan <description>  |  /plan resume\n");
        prompt();
        return;
      }
      console.log("Planning...");
      try {
        const plan = await createPlan(description, workDir);
        savePlan(plan, workDir);
        console.log("\n" + formatPlan(plan) + "\n");
        console.log(`Plan saved to ${workDir}/.autoagent-plan.json`);

        // Ask whether to execute the plan
        const answer = await new Promise<string>((resolve) => {
          rl.question("Execute this plan? (y/n) ", resolve);
        });

        if (answer.trim().toLowerCase() === "y") {
          console.log("");
          await executePlan(plan, makePlanExecutor(), (task, updatedPlan) => {
            if (task.status === "done") {
              process.stdout.write(`\x1b[32m✓ [${task.id}] Done: ${task.title}\x1b[0m\n`);
            } else if (task.status === "failed") {
              process.stdout.write(`\x1b[31m✗ [${task.id}] Failed: ${task.title} — ${task.error ?? ""}\x1b[0m\n`);
            }
            void updatedPlan;
          });
          // Persist updated statuses/results after execution
          savePlan(plan, workDir);
          console.log("\n" + formatPlan(plan) + "\n");
        }
      } catch (err) {
        console.error(`Plan error: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      prompt();
      return;
    }

    // ─── Send to orchestrator ────────────────────────────

    isResponding = true;
    process.stdout.write("\n");

    try {
      const result = await orchestrator.send(trimmed);

      // Ensure we end on a newline after streaming
      if (result.text && !result.text.endsWith("\n")) {
        process.stdout.write("\n");
      }
      process.stdout.write("\n");

      // Show auto-commit result if any
      if (result.commitResult?.committed) {
        process.stderr.write(
          `\x1b[32m  ✓ Auto-committed: ${result.commitResult.message}\x1b[0m\n`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") || msg.includes("Aborted")) {
        process.stderr.write(`\x1b[33m  Request aborted.\x1b[0m\n`);
      } else {
        console.error(`\x1b[31mError: ${msg}\x1b[0m`);
      }
      process.stdout.write("\n");
    } finally {
      isResponding = false;
    }

    prompt();
  });
}

prompt();
