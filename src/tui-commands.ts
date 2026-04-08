/**
 * TUI command router — extracted from tui.tsx to keep the App component focused on layout.
 *
 * Each slash command is a handler function that receives a CommandContext.
 */

import path from "path";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { Orchestrator } from "./orchestrator.js";
import type { Message } from "./tui.js";
import type { SessionInfo } from "./session-store.js";
import { listSessions } from "./session-store.js";
import { undoLastCommit } from "./auto-commit.js";
import { buildRepoMap, fuzzySearch, type RepoMap } from "./tree-sitter-map.js";
import { runInit } from "./init-command.js";
import { buildExportContent as buildExportContentHelper } from "./export-helper.js";
import { handlePlanCommand } from "./plan-commands.js";
import { runDream } from "./dream.js";
import { _searchIndexHolder, buildSearchIndex } from "./tool-registry.js";

export interface FooterStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
  contextTokens: number;
  contextLimit: number;
}

export interface CommandContext {
  workDir: string;
  orchestratorRef: React.MutableRefObject<Orchestrator | null>;
  messages: Message[];
  addMessage: (msg: Message) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setStatus: (s: string) => void;
  setLoading: (b: boolean) => void;
  currentModel: string;
  setCurrentModel: (m: string) => void;
  footerStats: FooterStats;
  setFooterStats: React.Dispatch<React.SetStateAction<FooterStats>>;
  setContextWarning: (b: boolean) => void;
  repoMapRef: React.MutableRefObject<RepoMap | null>;
  sessionList: SessionInfo[];
  setSessionList: React.Dispatch<React.SetStateAction<SessionInfo[]>>;
  exit: () => void;
}

type CommandHandler = (ctx: CommandContext, args: string) => Promise<boolean>;

const commands: Record<string, CommandHandler> = {
  "/clear": async (ctx) => {
    ctx.orchestratorRef.current?.clearHistory();
    ctx.setMessages([]);
    ctx.setContextWarning(false);
    const limit = ctx.orchestratorRef.current?.getCost()?.contextLimit ?? 200_000;
    ctx.setFooterStats({ tokensIn: 0, tokensOut: 0, cost: 0, model: ctx.currentModel, contextTokens: 0, contextLimit: limit });
    ctx.setStatus("Cleared");
    setTimeout(() => ctx.setStatus(""), 1000);
    return true;
  },

  "/compact": async (ctx) => {
    ctx.setStatus("Compacting context...");
    await ctx.orchestratorRef.current?.compactNow();
    ctx.addMessage({ role: "assistant", content: "Context compacted." });
    ctx.setStatus("");
    return true;
  },

  "/dream": async (ctx) => {
    ctx.addMessage({ role: "assistant", content: "🌙 Running memory consolidation..." });
    try {
      const result = await runDream(process.cwd(), new Anthropic());
      ctx.addMessage({ role: "assistant", content: `🌙 Dream complete: +${result.added} entries, -${result.removed} entries removed.` });
    } catch (err: any) {
      ctx.addMessage({ role: "assistant", content: `Dream failed: ${err.message}` });
    }
    return true;
  },

  "/reindex": async (ctx) => {
    ctx.setStatus("Re-indexing repo...");
    ctx.orchestratorRef.current?.reindex();
    try {
      const out = execSync(`git -C ${JSON.stringify(ctx.workDir)} ls-files`, { encoding: "utf8" });
      const allFiles = out.split("\n").filter(Boolean);
      ctx.repoMapRef.current = buildRepoMap(ctx.workDir, allFiles);
    } catch { /* ignore */ }
    ctx.setStatus("Re-indexed");
    setTimeout(() => ctx.setStatus(""), 1000);
    return true;
  },

  "/exit": async (ctx) => {
    if (ctx.messages.length > 2) {
      try {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filePath = path.join(ctx.workDir, ".autoagent", "exports", `session-${timestamp}.md`);
        const model = ctx.orchestratorRef.current?.getModel() ?? ctx.footerStats.model;
        const exportMsgs = ctx.messages.filter(m => m.role === "user" || m.role === "assistant") as import("./export-helper.js").ExportMessage[];
        buildExportContentHelper(exportMsgs, model, { tokensIn: ctx.footerStats.tokensIn, tokensOut: ctx.footerStats.tokensOut, cost: ctx.footerStats.cost }, ctx.workDir, filePath);
      } catch { /* never block exit */ }
    }
    ctx.exit();
    return true;
  },

  "/init": async (ctx) => {
    ctx.setStatus("Analyzing project...");
    try {
      const { content, updated } = await runInit(ctx.workDir, (msg) => ctx.setStatus(msg));
      ctx.setStatus("");
      const preview = content.split("\n").slice(0, 20).join("\n");
      const truncated = content.split("\n").length > 20 ? "\n...(truncated)" : "";
      ctx.addMessage({
        role: "assistant",
        content: `${updated ? "Updated" : "Created"} .autoagent.md:\n\n\`\`\`markdown\n${preview}${truncated}\n\`\`\``,
      });
    } catch (err) {
      ctx.setStatus("");
      ctx.addMessage({
        role: "assistant",
        content: `Failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return true;
  },

  "/help": async (ctx) => {
    ctx.addMessage({
      role: "assistant",
      content: [
        `Current model: ${ctx.currentModel}`,
        "",
        "Available commands:",
        "  /help     — Show this help message",
        "  /init     — Analyze repo and generate/update .autoagent.md",
        "  /status   — Show session stats (turns, tokens, cost, model)",
        "  /find Q   — Fuzzy search files & symbols in the repo",
        "  /search Q — BM25 semantic code search (concept-based)",
        "  /model    — Show current model (or /model haiku|sonnet to switch)",
        "  /clear    — Clear the conversation history",
        "  /reindex  — Re-index the repository files",
        "  /resume   — List and restore a previous session",
        "  /rewind   — Restore conversation to a prior checkpoint",
        "  /compact  — Manually compact conversation context",
        "  /dream    — Consolidate session memory",
        "  /diff     — Show uncommitted git changes",
        "  /undo     — Revert the last autoagent commit",
        "  /plan Q   — Create and execute a task plan for Q",
        "  /plan list — Show saved plans",
        "  /plan resume — Resume the most recent incomplete plan",
        "  /export   — Export conversation to markdown (optional filename arg)",
        "  /exit     — Quit AutoAgent",
      ].join("\n"),
    });
    return true;
  },

  "/rewind": async (ctx, args) => {
    if (!args) {
      const checkpoints = ctx.orchestratorRef.current?.getCheckpoints() ?? [];
      if (checkpoints.length === 0) {
        ctx.addMessage({ role: "assistant", content: "No checkpoints yet. Send a message first." });
        return true;
      }
      const lines = ["Conversation checkpoints (select with /rewind <number>):"];
      lines.push("  [0] now (current state)");
      checkpoints.slice().reverse().forEach((cp, i) => {
        const t = new Date(cp.timestamp).toLocaleTimeString();
        lines.push(`  [${i + 1}] "${cp.label}" (${t})`);
      });
      lines.push("\nType /rewind <number> to restore that checkpoint.");
      ctx.addMessage({ role: "assistant", content: lines.join("\n") });
      return true;
    }
    const idx = parseInt(args, 10);
    if (isNaN(idx)) return false;
    if (idx === 0) {
      ctx.addMessage({ role: "assistant", content: "Already at current state." });
      return true;
    }
    const checkpoints = ctx.orchestratorRef.current?.getCheckpoints() ?? [];
    const reversed = checkpoints.slice().reverse();
    const cp = reversed[idx - 1];
    if (!cp) {
      ctx.addMessage({ role: "assistant", content: "Invalid checkpoint number." });
      return true;
    }
    const result = ctx.orchestratorRef.current?.rewindTo(cp.id);
    if (result) {
      ctx.addMessage({ role: "assistant", content: `↩ Rewound to: "${result.label}"` });
    } else {
      ctx.addMessage({ role: "assistant", content: "Could not rewind to that checkpoint." });
    }
    return true;
  },

  "/status": async (ctx) => {
    const turns = ctx.messages.filter(m => m.role === "user").length;
    const { tokensIn, tokensOut, cost, model } = ctx.footerStats;
    const costStr = cost < 0.01 ? `${cost.toFixed(4)}` : `${cost.toFixed(2)}`;
    const stats = ctx.orchestratorRef.current?.getSessionStats();
    const sessionLines: string[] = [];
    if (stats) {
      const totalSec = Math.floor(stats.durationMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      sessionLines.push(`  Session:        ${m}m ${s}s`);
      sessionLines.push(`  Cost:           ${stats.costSummary}`);
      sessionLines.push(`  Avg cost/turn:  ${stats.avgCostPerTurn.toFixed(4)}`);
      sessionLines.push(`  Cost trend:     ${stats.costTrend}`);
      if (stats.filesModified?.length) {
        sessionLines.push(`  Files changed:  ${stats.filesModified.length} — ${stats.filesModified.join(", ")}`);
      }
    }
    // Tool performance timings
    const timingLines: string[] = [];
    const timings = ctx.orchestratorRef.current?.getToolTimings();
    if (timings && timings.length > 0) {
      timingLines.push(`  ⏱ Tool Performance (top 5 slowest):`);
      const top5 = timings
        .sort((a, b) => b.avgMs - a.avgMs)
        .slice(0, 5);
      for (const t of top5) {
        timingLines.push(`    ${t.toolName}: ${Math.round(t.avgMs)}ms avg (${t.calls} calls)`);
      }
    }

    ctx.addMessage({
      role: "assistant",
      content: [
        "Session Status:",
        `  Turns:      ${turns}`,
        `  Tokens in:  ${tokensIn.toLocaleString()}`,
        `  Tokens out: ${tokensOut.toLocaleString()}`,
        `  Cost:       ${costStr}`,
        `  Model:      ${model}`,
        ...sessionLines,
        ...timingLines,
      ].join("\n"),
    });
    return true;
  },

  "/find": async (ctx, query) => {
    if (!query) {
      ctx.addMessage({ role: "assistant", content: "Usage: /find <query>" });
      return true;
    }
    try {
      // Use cached repoMap if available, otherwise rebuild
      let repoMap = ctx.repoMapRef.current;
      if (!repoMap) {
        const allFiles = execSync(
          "git ls-files --cached --others --exclude-standard 2>/dev/null || find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' | head -200",
          { cwd: ctx.workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
        ).trim().split("\n").filter(Boolean).slice(0, 200);
        repoMap = buildRepoMap(ctx.workDir, allFiles);
        ctx.repoMapRef.current = repoMap;
      }
      const results = fuzzySearch(repoMap, query, 15);
      if (results.length === 0) {
        ctx.addMessage({ role: "assistant", content: `No matches for "${query}"` });
      } else {
        const lines = results.map(r => {
          if (r.symbol) {
            return `  ${r.file}:${r.line}  ${r.symbol} (${r.kind})  [${(r.score * 100).toFixed(0)}%]`;
          }
          return `  ${r.file}  [${(r.score * 100).toFixed(0)}%]`;
        });
        ctx.addMessage({
          role: "assistant",
          content: `🔍 Results for "${query}":\n${lines.join("\n")}`,
        });
      }
    } catch {
      ctx.addMessage({ role: "assistant", content: "Search failed — could not build repo map." });
    }
    return true;
  },

  "/search": async (ctx, query) => {
    if (!query) {
      ctx.addMessage({ role: "assistant", content: "Usage: /search <query>" });
      return true;
    }
    try {
      if (_searchIndexHolder.index.fileCount === 0) {
        ctx.addMessage({ role: "assistant", content: "Building search index…" });
        await buildSearchIndex(ctx.workDir);
      }
      const results = _searchIndexHolder.index.search(query, 5);
      if (results.length === 0) {
        ctx.addMessage({ role: "assistant", content: `No results for "${query}"` });
      } else {
        const lines = results.map((r, i) =>
          `${i + 1}. ${r.file}:${r.lineStart}-${r.lineEnd}  score=${r.score.toFixed(2)}\n   ${r.snippet.replace(/\n/g, " ").slice(0, 120)}`
        );
        ctx.addMessage({
          role: "assistant",
          content: `🔍 Semantic results for "${query}":\n\n${lines.join("\n\n")}`,
        });
      }
    } catch (err) {
      ctx.addMessage({ role: "assistant", content: `Search failed: ${String(err)}` });
    }
    return true;
  },

  "/diff": async (ctx) => {
    try {
      const isRepo = execSync("git rev-parse --is-inside-work-tree", {
        cwd: ctx.workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      if (isRepo !== "true") throw new Error("not a repo");
      const stat = execSync("git diff --stat", { cwd: ctx.workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      const diff = execSync("git diff", { cwd: ctx.workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      const combined = [stat, diff].filter(Boolean).join("\n\n");
      if (!combined) {
        ctx.addMessage({ role: "assistant", content: "No uncommitted changes." });
      } else {
        const lines = combined.split("\n");
        const truncated = lines.length > 200 ? lines.slice(0, 200).join("\n") + "\n(truncated)" : combined;
        ctx.addMessage({ role: "assistant", content: truncated });
      }
    } catch {
      ctx.addMessage({ role: "assistant", content: "No uncommitted changes." });
    }
    return true;
  },

  "/undo": async (ctx) => {
    const result = await undoLastCommit(ctx.workDir);
    if (result.undone) {
      ctx.addMessage({ role: "assistant", content: `✓ Undid commit ${result.hash}: ${result.message}` });
    } else {
      ctx.addMessage({ role: "assistant", content: `Cannot undo: ${result.error}` });
    }
    return true;
  },

  "/model": async (ctx, arg) => {
    const MODEL_ALIASES: Record<string, string> = {
      haiku: "claude-haiku-4-5",
      sonnet: "claude-sonnet-4-6",
      opus: "claude-opus-4-6",
    };
    if (!arg) {
      const current = ctx.orchestratorRef.current?.getModel() ?? "auto";
      ctx.addMessage({ role: "assistant", content: `Current model: ${current}` });
    } else if (arg === "reset" || arg === "auto") {
      ctx.orchestratorRef.current?.setModel(null);
      ctx.setCurrentModel("auto");
      ctx.addMessage({ role: "assistant", content: "Model reset to auto-routing (keyword-based)." });
    } else {
      const resolved = MODEL_ALIASES[arg] ?? (arg.startsWith("claude-") ? arg : null);
      if (!resolved) {
        ctx.addMessage({
          role: "assistant",
          content: `Unknown model "${arg}". Use: haiku, sonnet, opus, reset, or a full model ID.`,
        });
      } else {
        ctx.orchestratorRef.current?.setModel(resolved);
        ctx.setCurrentModel(resolved);
        ctx.addMessage({ role: "assistant", content: `Switched to ${resolved}` });
      }
    }
    return true;
  },

  "/resume": async (ctx, args) => {
    if (args) {
      const idx = parseInt(args, 10) - 1;
      if (idx >= 0 && idx < ctx.sessionList.length) {
        const session = ctx.sessionList[idx];
        ctx.orchestratorRef.current?.resumeSession(session.path);
        ctx.addMessage({
          role: "assistant",
          content: `✓ Resumed session: "${session.summary}" (${session.messageCount} messages loaded)`,
        });
      } else {
        ctx.addMessage({ role: "assistant", content: "Invalid session number." });
      }
      return true;
    }
    const sessions = listSessions(ctx.workDir);
    if (sessions.length === 0) {
      ctx.addMessage({ role: "assistant", content: "No saved sessions found." });
    } else {
      ctx.setSessionList(sessions);
      const listing = sessions
        .slice(0, 10)
        .map((s, i) => `  [${i + 1}] ${s.summary} (${s.messageCount} msgs, ${s.updatedAt.toLocaleDateString()})`)
        .join("\n");
      ctx.addMessage({
        role: "assistant",
        content: `Recent sessions:\n${listing}\n\nType /resume <number> to load a session.`,
      });
    }
    return true;
  },

  "/plan": async (ctx, args) => {
    await handlePlanCommand(args, {
      workDir: ctx.workDir,
      addMessage: (text) => ctx.addMessage({ role: "assistant", content: text }),
      execute: async (description) => {
        const res = await ctx.orchestratorRef.current!.send(description);
        return res.text ?? "done";
      },
      setLoading: ctx.setLoading,
      setStatus: ctx.setStatus,
    });
    return true;
  },

  "/export": async (ctx, arg) => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = arg || `session-export-${timestamp}.md`;
    const filePath = path.isAbsolute(filename) ? filename : path.join(ctx.workDir, filename);
    try {
      const model = ctx.orchestratorRef.current?.getModel() ?? ctx.footerStats.model;
      const exportMsgs = ctx.messages.filter(m => m.role === "user" || m.role === "assistant") as import("./export-helper.js").ExportMessage[];
      buildExportContentHelper(exportMsgs, model, { tokensIn: ctx.footerStats.tokensIn, tokensOut: ctx.footerStats.tokensOut, cost: ctx.footerStats.cost }, ctx.workDir, filePath);
      ctx.addMessage({ role: "assistant", content: `Exported to ${filename}` });
    } catch (err) {
      ctx.addMessage({ role: "assistant", content: `Export failed: ${err instanceof Error ? err.message : err}` });
    }
    return true;
  },
};

/**
 * Route a slash command to its handler.
 * Returns true if a command was handled, false if the input is not a command.
 */
export async function routeCommand(trimmed: string, ctx: CommandContext): Promise<boolean> {
  // Extract the command name and args
  const spaceIdx = trimmed.indexOf(" ");
  const cmdName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  const handler = commands[cmdName];
  if (handler) {
    return handler(ctx, args);
  }
  return false;
}
