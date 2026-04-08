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
import { checkpointManager } from "./checkpoint.js";
import { getRecentSessions, searchSessions, clearSessionHistory } from "./session-history.js";

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
  autoAccept: boolean;
  setAutoAccept: (b: boolean) => void;
  exit: () => void;
  inputHistory?: string[];
  submitMessage?: (msg: string) => Promise<void>;
}

type CommandHandler = (ctx: CommandContext, args: string) => Promise<boolean>;

const commands: Record<string, CommandHandler> = {
  "/autoaccept": async (ctx) => {
    const next = !ctx.autoAccept;
    ctx.setAutoAccept(next);
    ctx.addMessage({
      role: "assistant",
      content: next
        ? "Auto-accept enabled — edits will be applied without confirmation."
        : "Auto-accept disabled — edits will require Y/N confirmation.",
    });
    return true;
  },

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
    // Print session cost summary before exit
    const costTracker = ctx.orchestratorRef.current?.getCostTracker?.();
    if (costTracker && costTracker.entryCount > 0) {
      ctx.addMessage({ role: "assistant", content: `Session cost: ${costTracker.sessionSummary}` });
    }
    ctx.exit();
    return true;
  },

  "/retry": async (ctx) => {
    // Find last user message from conversation history
    const lastUserMsg = [...ctx.messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg || typeof lastUserMsg.content !== "string") {
      ctx.addMessage({ role: "assistant", content: "Nothing to retry." });
      return true;
    }
    if (ctx.submitMessage) {
      await ctx.submitMessage(lastUserMsg.content);
    } else {
      ctx.addMessage({ role: "assistant", content: "Retry not available in this context." });
    }
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
        "━━ Navigation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  /help                 — Show this help message",
        "  /clear                — Clear the conversation history",
        "  /compact              — Manually compact conversation context",
        "  /rewind               — Restore conversation to a prior checkpoint",
        "  /checkpoint           — List file checkpoints",
        "  /checkpoint rollback <id>  — Roll back files to a checkpoint",
        "  /retry                — Re-send the last user message",
        "  /exit                 — Quit AutoAgent",
        "",
        "━━ Search ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  /find <query>         — Fuzzy search files & symbols in the repo",
        "  /search <query>       — BM25 semantic code search (concept-based)",
        "  /tools search <query> — Search registered tools by keyword",
        "",
        "━━ Session ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  /resume               — List and restore a previous session",
        "  /sessions             — Browse, search, or clear saved sessions",
        "  /export [filename]    — Export conversation to markdown",
        "  /dream                — Consolidate session memory into .autoagent.md",
        "",
        "━━ Repository ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  /diff                 — Show uncommitted git changes",
        "  /undo                 — Revert the last autoagent commit",
        "  /reindex              — Re-index the repository files",
        "  /init                 — Analyze repo and generate/update .autoagent.md",
        "  /branch               — List saved branch snapshots",
        "  /branch save [name]   — Save current branch state",
        "  /branch restore <id>  — Restore a saved branch snapshot",
        "",
        "━━ Planning ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  /plan <query>         — Create and execute a task plan",
        "  /plan list            — Show saved plans",
        "  /plan resume          — Resume the most recent incomplete plan",
        "",
        "━━ Configuration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  /model                — Show current model",
        "  /model haiku|sonnet   — Switch to a different model",
        "  /autoaccept           — Toggle auto-accept edits (skip Y/N prompts)",
        "  /status               — Show session stats (turns, tokens, cost, tool usage)",
        "  /timing               — Show detailed tool performance timings",
        "  /tools                — List all registered tools with descriptions",
        "  /tools stats          — Show tool usage counts and timings for this session",
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

  "/checkpoint": async (ctx, args) => {
    const subCmd = (args ?? "").trim().split(/\s+/);

    if (subCmd[0] === "rollback" && subCmd[1]) {
      const id = parseInt(subCmd[1], 10);
      if (isNaN(id)) {
        ctx.addMessage({ role: "assistant", content: "Usage: /checkpoint rollback <id>" });
        return true;
      }
      const result = checkpointManager.rollback(id);
      if (result.errors.length > 0) {
        ctx.addMessage({ role: "assistant", content: `Rolled back ${result.restored} files. Errors:\n${result.errors.join("\n")}` });
      } else if (result.restored === 0) {
        ctx.addMessage({ role: "assistant", content: `Checkpoint ${id} not found.` });
      } else {
        ctx.addMessage({ role: "assistant", content: `✓ Rolled back ${result.restored} file(s) to checkpoint ${id}.` });
      }
      return true;
    }

    // Default: list checkpoints
    const items = checkpointManager.list(10);
    if (items.length === 0) {
      ctx.addMessage({ role: "assistant", content: "No file checkpoints yet. Checkpoints are created automatically when files are edited." });
      return true;
    }
    const lines = ["File checkpoints (rollback with /checkpoint rollback <id>):", ""];
    for (const cp of items) {
      const ago = Math.round((Date.now() - cp.timestamp) / 60000);
      lines.push(`  #${cp.id} | ${cp.label} | ${cp.fileCount} file(s) | ${ago}m ago`);
    }
    ctx.addMessage({ role: "assistant", content: lines.join("\n") });
    return true;
  },

  "/timing": async (ctx) => {
    const timings = ctx.orchestratorRef.current?.getToolTimings() ?? [];
    if (timings.length === 0) {
      ctx.addMessage({ role: "assistant", content: "No tool timings recorded yet." });
      return true;
    }
    const sorted = [...timings].sort((a: { avgMs: number }, b: { avgMs: number }) => b.avgMs - a.avgMs);
    const totalCalls = sorted.reduce((sum: number, t: { calls: number }) => sum + t.calls, 0);
    const lines = ["Tool Performance Timings:", ""];
    lines.push(`  Total tool calls: ${totalCalls}`);
    lines.push("");
    lines.push("  Tool               Calls    Avg (ms)");
    lines.push("  ────────────────── ──────── ────────");
    for (const t of sorted) {
      const name = (t as { toolName: string }).toolName.padEnd(18);
      const calls = String((t as { calls: number }).calls).padStart(8);
      const avg = String(Math.round((t as { avgMs: number }).avgMs)).padStart(8);
      lines.push(`  ${name} ${calls} ${avg}`);
    }
    ctx.addMessage({ role: "assistant", content: lines.join("\n") });
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
    // Context efficiency stats
    const effLines: string[] = [];
    const ctxEff = ctx.orchestratorRef.current?.getContextEfficiency();
    const eff = ctx.orchestratorRef.current?.getTokenEfficiency();
    if (ctxEff && ctxEff.currentTokens > 0) {
      const cur = Math.round(ctxEff.currentTokens / 1000);
      const avg = Math.round(ctxEff.avgTokensPerTurn / 1000);
      const peak = Math.round(ctxEff.peakTokens / 1000);
      const utilPct = eff?.currentUtilPct ?? Math.round((ctxEff.currentTokens / 200_000) * 100);
      const color = utilPct >= 90 ? "🔴" : utilPct >= 70 ? "🟡" : "🟢";
      effLines.push(`  ${color} Context: ${cur}K tokens (avg ${avg}K/turn, peak ${peak}K)`);
    } else if (eff && eff.avgInput > 0) {
      effLines.push(`  ⚡ Context Efficiency:`);
      effLines.push(`    Avg input/turn:   ${eff.avgInput.toLocaleString()} tokens`);
      effLines.push(`    Avg output/turn:  ${eff.avgOutput.toLocaleString()} tokens`);
      effLines.push(`    Peak input:       ${eff.peakInput.toLocaleString()} tokens (turn ${eff.peakTurn})`);
      effLines.push(`    Context util:     ${eff.currentUtilPct}% of 200K`);
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

    // Tool usage counts
    const usageLines: string[] = [];
    const toolUsage = stats?.toolUsage ?? {};
    const usageEntries = Object.entries(toolUsage).sort((a, b) => b[1] - a[1]);
    if (usageEntries.length > 0) {
      usageLines.push(`  🔧 Tool Usage (${usageEntries.length} tools):`);
      for (const [name, count] of usageEntries) {
        usageLines.push(`    ${name}: ${count} calls`);
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
        ...effLines,
        ...timingLines,
        ...usageLines,
      ].join("\n"),
    });
    return true;
  },

  "/tools": async (ctx, args) => {
    const sub = args?.trim() ?? "";
    if (sub === "stats") {
      const stats = ctx.orchestratorRef.current?.getSessionStats();
      const timings = ctx.orchestratorRef.current?.getToolTimings() ?? [];
      const toolUsage = stats?.toolUsage ?? {};
      const entries = Object.entries(toolUsage).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) {
        ctx.addMessage({ role: "assistant", content: "No tool calls recorded this session." });
        return true;
      }
      const timingMap = new Map(timings.map(t => [t.toolName, t]));
      const lines = ["Tool Usage Stats (this session):", ""];
      lines.push("  Tool                   Calls  Avg (ms)");
      lines.push("  ───────────────────── ─────── ─────────");
      for (const [name, count] of entries) {
        const t = timingMap.get(name);
        const avg = t ? String(Math.round(t.avgMs)).padStart(9) : "        —";
        lines.push(`  ${name.padEnd(21)} ${String(count).padStart(7)}${avg}`);
      }
      ctx.addMessage({ role: "assistant", content: lines.join("\n") });
      return true;
    }

    if (sub.startsWith("search ")) {
      const query = sub.slice(7).trim();
      if (!query) {
        ctx.addMessage({ role: "assistant", content: "Usage: /tools search <query>" });
        return true;
      }
      const { createDefaultRegistry: cdr } = await import("./tool-registry.js");
      const results = cdr().searchTools(query);
      if (!results || results.length === 0) {
        ctx.addMessage({ role: "assistant", content: `No tools matching "${query}".` });
        return true;
      }
      const lines = [`Tools matching "${query}":`, ""];
      for (const t of results) {
        const desc = (t.definition.description ?? "").split("\n")[0];
        lines.push(`  ${t.definition.name.padEnd(22)} ${desc}`);
      }
      ctx.addMessage({ role: "assistant", content: lines.join("\n") });
      return true;
    }

    // Default: list all tools using dynamic import (ESM)
    const { createDefaultRegistry } = await import("./tool-registry.js");
    const tempReg = createDefaultRegistry();
    const defs = tempReg.getDefinitions();
    if (!defs || defs.length === 0) {
      ctx.addMessage({ role: "assistant", content: "No tools registered." });
      return true;
    }
    const lines = [`Registered tools (${defs.length}):`, ""];
    for (const d of defs) {
      const desc = (d.description ?? "").split("\n")[0].slice(0, 60);
      lines.push(`  ${d.name.padEnd(22)} ${desc}`);
    }
    lines.push("");
    lines.push("  Use /tools stats to see usage counts and timings.");
    lines.push("  Use /tools search <query> to find tools by keyword.");
    ctx.addMessage({ role: "assistant", content: lines.join("\n") });
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
      const turnCount = exportMsgs.filter(m => m.role === "user").length;
      buildExportContentHelper(exportMsgs, model, { tokensIn: ctx.footerStats.tokensIn, tokensOut: ctx.footerStats.tokensOut, cost: ctx.footerStats.cost, turnCount }, ctx.workDir, filePath);
      ctx.addMessage({ role: "assistant", content: `Exported to ${filename}` });
    } catch (err) {
      ctx.addMessage({ role: "assistant", content: `Export failed: ${err instanceof Error ? err.message : err}` });
    }
    return true;
  },

  "/branch": async (ctx, args) => {
    const orch = ctx.orchestratorRef.current;
    if (!orch) {
      ctx.addMessage({ role: "assistant", content: "No active session." });
      return true;
    }
    const parts = args.trim().split(/\s+/);
    const sub = parts[0];
    const name = parts[1];

    if (!sub || sub === "list") {
      const names = orch.listBranches();
      if (names.length === 0) {
        ctx.addMessage({ role: "assistant", content: "No saved branches. Use `/branch save <name>` to save one." });
      } else {
        ctx.addMessage({ role: "assistant", content: `Saved branches:\n${names.map(n => `  • ${n}`).join("\n")}` });
      }
      return true;
    }

    if (sub === "save") {
      if (!name) {
        ctx.addMessage({ role: "assistant", content: "Usage: /branch save <name>" });
        return true;
      }
      orch.saveBranch(name);
      ctx.addMessage({ role: "assistant", content: `✓ Saved branch "${name}".` });
      return true;
    }

    if (sub === "restore") {
      if (!name) {
        ctx.addMessage({ role: "assistant", content: "Usage: /branch restore <name>" });
        return true;
      }
      const ok = orch.restoreBranch(name);
      if (ok) {
        ctx.addMessage({ role: "assistant", content: `✓ Restored branch "${name}". Conversation rewound to that point.` });
      } else {
        ctx.addMessage({ role: "assistant", content: `Branch "${name}" not found. Use /branch to list saved branches.` });
      }
      return true;
    }

    ctx.addMessage({ role: "assistant", content: "Usage: /branch [list] | /branch save <name> | /branch restore <name>" });
    return true;
  },

  "/sessions": async (ctx, args) => {
    const formatSession = (s: import("./session-history.js").SessionHistoryEntry) => {
      const date = new Date(s.date).toLocaleDateString("en-CA"); // YYYY-MM-DD
      const cost = `${s.cost.toFixed(2)}`;
      const topic = s.firstMessage.length > 40 ? s.firstMessage.slice(0, 40) + "…" : s.firstMessage;
      return `${date}  ${String(s.turns).padStart(2)} turns  ${cost.padStart(7)}  "${topic}"`;
    };

    if (args.startsWith("search ")) {
      const query = args.slice("search ".length).trim();
      if (!query) {
        ctx.addMessage({ role: "assistant", content: "Usage: /sessions search <term>" });
        return true;
      }
      const results = searchSessions(query);
      if (results.length === 0) {
        ctx.addMessage({ role: "assistant", content: `No sessions matching "${query}".` });
        return true;
      }
      ctx.addMessage({ role: "assistant", content: `Sessions matching "${query}":\n${results.map(formatSession).join("\n")}` });
      return true;
    }

    if (args === "clear") {
      clearSessionHistory();
      ctx.addMessage({ role: "assistant", content: "✓ Session history cleared." });
      return true;
    }

    const sessions = getRecentSessions(10);
    if (sessions.length === 0) {
      ctx.addMessage({ role: "assistant", content: "No session history found. Sessions are recorded when you exit." });
      return true;
    }
    ctx.addMessage({ role: "assistant", content: `Recent sessions:\n${sessions.map(formatSession).join("\n")}` });
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
