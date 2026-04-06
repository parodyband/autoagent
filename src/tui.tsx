/**
 * AutoAgent Interactive TUI — React-based terminal UI using Ink.
 *
 * Usage:
 *   npm run tui                          # work in current directory
 *   npm run tui -- --dir /path/to/repo   # work in a specific repo
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import path from "path";
import fs from "fs";
import "dotenv/config";
import { Orchestrator } from "./orchestrator.js";
import { listSessions, type SessionInfo } from "./session-store.js";
import type { EditPlan } from "./architect-mode.js";
import { VirtualMessageList } from "./virtual-message-list.js";
import { undoLastCommit } from "./auto-commit.js";
import { buildRepoMap, fuzzySearch } from "./tree-sitter-map.js";
import { execSync } from "child_process";
import { runInit } from "./init-command.js";
import { buildExportContent as buildExportContentHelper } from "./export-helper.js";
import { shouldShowWelcome } from "./welcome.js";
import type { Task, TaskPlan } from "./task-planner.js";
import { handlePlanCommand } from "./plan-commands.js";
import { runDream } from "./dream.js";
import { _searchIndexHolder, buildSearchIndex } from "./tool-registry.js";
import Anthropic from "@anthropic-ai/sdk";
import { Markdown } from "./markdown-renderer.js";

// Parse args
let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
}

// --no-confirm flag: skip write_file diff confirmation
const noConfirm = process.argv.includes("--no-confirm");

// ─── CLI Subcommand Routing ──────────────────────────────────
// Must run before TUI render. If first arg is a known subcommand, handle it and exit.
if (process.argv[2] === "init") {
  runInit(workDir, (msg) => console.log(msg))
    .then(({ content, updated }) => {
      console.log(updated ? "✓ Updated .autoagent.md" : "✓ Created .autoagent.md");
      console.log("\n" + content);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Init failed:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}

// --continue / -c flag: auto-resume most recent session
const continueFlag =
  process.argv.includes("--continue") || process.argv.includes("-c");
let initialResumeSessionPath: string | undefined;
if (continueFlag) {
  const recentSessions = listSessions(workDir);
  if (recentSessions.length > 0) {
    initialResumeSessionPath = recentSessions[0].path;
  } else {
    // Will show warning in TUI after mount
  }
}

// ─── Types ──────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  tokens?: { in: number; out: number };
  model?: string;
  verificationPassed?: boolean;
}

interface PendingDiff {
  diff: string;
  filePath: string;
  resolve: (accepted: boolean) => void;
}

interface FooterStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
  contextTokens: number;
  contextLimit: number;
}

// ─── Context budget color helper ────────────────────────────

/** Returns color string for context budget display based on usage ratio. */
export function getContextColor(ratio: number): string {
  if (ratio >= 0.9) return "red";
  if (ratio >= 0.7) return "yellow";
  return "gray";
}

// ─── #file hint pure helpers ────────────────────────────────

/**
 * If the input contains `#` followed by partial text, return that partial.
 * Returns null if no `#` trigger is present.
 * E.g. "look at #src/orch" → "src/orch"
 *      "hello world"       → null
 */
export function extractFileQuery(input: string): string | null {
  const idx = input.lastIndexOf("#");
  if (idx === -1) return null;
  // Only trigger when # is not followed by a space (or is at end)
  const after = input.slice(idx + 1);
  if (after.includes(" ")) return null; // completed word — no longer partial
  return after; // may be empty string (just typed #)
}

/**
 * Given a partial file query string and a RepoMap, return up to `limit`
 * matching file paths.
 */
export function getFileSuggestions(
  repoMap: import("./tree-sitter-map.js").RepoMap,
  partial: string,
  limit = 5
): string[] {
  if (!repoMap || repoMap.files.length === 0) return [];
  const results = fuzzySearch(repoMap, partial || "", limit);
  // deduplicate by file path and return just the paths
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const r of results) {
    if (!seen.has(r.file)) {
      seen.add(r.file);
      paths.push(r.file);
    }
    if (paths.length >= limit) break;
  }
  return paths;
}

// ─── Components ─────────────────────────────────────────────

interface GitInfo {
  branch: string;
  changedCount: number;
  stagedCount: number;
  isRepo: boolean;
}

function useGitStatus(dir: string): GitInfo {
  const [info, setInfo] = useState<GitInfo>({ branch: "", changedCount: 0, stagedCount: 0, isRepo: false });

  useEffect(() => {
    function poll() {
      try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        const statusOut = execSync("git status --short", {
          cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
        });
        const lines = statusOut.split("\n").filter(l => l.trim().length > 0);
        // XY format: first char = staged, second = unstaged/untracked
        const staged = lines.filter(l => l[0] && l[0] !== " " && l[0] !== "?").length;
        const unstaged = lines.filter(l => l[1] && (l[1] !== " ")).length;
        setInfo({ branch, changedCount: unstaged, stagedCount: staged, isRepo: true });
      } catch {
        setInfo({ branch: "", changedCount: 0, stagedCount: 0, isRepo: false });
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [dir]);

  return info;
}

function GitBadge({ git }: { git: GitInfo }) {
  if (!git.isRepo) return null;
  const isDirty = git.changedCount > 0 || git.stagedCount > 0;
  const branchColor = isDirty ? "yellow" : "green";
  return (
    <Box>
      <Text color={branchColor}> ⎇ {git.branch}</Text>
      {git.stagedCount > 0 && (
        <Text color="green"> ●{git.stagedCount}</Text>
      )}
      {git.changedCount > 0 && (
        <Text color="yellow"> ±{git.changedCount}</Text>
      )}
      {!isDirty && (
        <Text color="green"> ✓</Text>
      )}
    </Box>
  );
}

function Header({ model, git }: { model: string; git: GitInfo }) {
  const modelLabel = model.includes("haiku") ? "⚡ haiku" : model.includes("opus") ? "◆ opus" : "◈ sonnet";
  return (
    <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="cyan">⚡ AutoAgent</Text>
          <Text color="gray">  </Text>
          <Text color="blueBright">{modelLabel}</Text>
          <GitBadge git={git} />
        </Box>
        <Text color="gray" dimColor>{path.basename(workDir)}</Text>
      </Box>
      <Text color="gray" dimColor>
        /help  /status  /clear  /diff  /undo  /plan  /search  /export  /exit
      </Text>
    </Box>
  );
}

function ToolCallDisplay({ name, input }: { name: string; input: string }) {
  return (
    <Box flexDirection="column" marginLeft={2} marginTop={0}>
      <Text>
        <Text color="yellow" dimColor>  ▸ </Text>
        <Text color="yellow" bold>{name}</Text>
        <Text color="gray" dimColor> {input.slice(0, 80)}{input.length > 80 ? "…" : ""}</Text>
      </Text>
    </Box>
  );
}

function MessageDisplay({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <Box marginTop={1} borderStyle="single" borderColor="cyan" borderLeft={true} borderRight={false} borderTop={false} borderBottom={false} paddingLeft={1}>
        <Text color="cyan" bold>You  </Text>
        <Text>{msg.content}</Text>
      </Box>
    );
  }
  if (msg.role === "tool") {
    return (
      <ToolCallDisplay
        name={msg.toolName || "tool"}
        input={msg.content}
      />
    );
  }
  // assistant
  const modelLabel = msg.model
    ? (msg.model.includes("haiku") ? "⚡ haiku" : msg.model.includes("opus") ? "◆ opus" : "◈ sonnet")
    : "";
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" borderLeft={true} borderRight={false} borderTop={false} borderBottom={false} paddingLeft={1}>
      <Box marginBottom={0}>
        <Text color="magenta" bold>Agent</Text>
        {modelLabel ? <Text color="gray" dimColor>  {modelLabel}</Text> : null}
        {msg.verificationPassed === true && <Text color="green" dimColor>  ✓</Text>}
        {msg.verificationPassed === false && <Text color="red" dimColor>  ✗</Text>}
      </Box>
      <Markdown>{msg.content}</Markdown>
      {msg.tokens && (
        <Text color="gray" dimColor>
          {msg.tokens.in.toLocaleString()} in / {msg.tokens.out.toLocaleString()} out
        </Text>
      )}
    </Box>
  );
}

/** Diff preview display — shown when agent proposes a file edit (or batch of edits). */
function DiffPreviewDisplay({ diff, filePath }: { diff: string; filePath: string }) {
  const lines = diff.split("\n");
  const isBatch = /^\d+ files$/.test(filePath);
  const header = isBatch ? `📝 Batch edit: ${filePath} changed` : `📝 ${filePath}`;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
      <Text bold>{header}</Text>
      {lines.map((line, i) => {
        if (line.startsWith("---") || line.startsWith("+++")) {
          return <Text key={i} color="yellow" bold>{line}</Text>;
        }
        if (line.startsWith("+")) {
          return <Text key={i} color="green">{line}</Text>;
        }
        if (line.startsWith("-")) {
          return <Text key={i} color="red">{line}</Text>;
        }
        if (line.startsWith("@@")) {
          return <Text key={i} color="cyan">{line}</Text>;
        }
        return <Text key={i}>{line}</Text>;
      })}
      <Text bold color="yellow">[Y]es / [n]o — Apply this change?</Text>
    </Box>
  );
}

/** Architect plan display — shown before execution begins. */
function PlanDisplay({ plan }: { plan: EditPlan }) {
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">📋 Architect Plan</Text>
      {plan.summary ? <Text color="white">{plan.summary}</Text> : null}
      {plan.steps.map((step, i) => {
        const icon = step.action === "create" ? "✚" : step.action === "delete" ? "✖" : "✎";
        const iconColor = step.action === "create" ? "green" : step.action === "delete" ? "red" : "yellow";
        return (
          <Box key={i} marginLeft={1}>
            <Text color={iconColor}>{icon} </Text>
            <Text color="cyan">{step.file}</Text>
            <Text color="gray"> — {step.description}</Text>
            {step.symbols && step.symbols.length > 0
              ? <Text color="gray" dimColor> [{step.symbols.join(", ")}]</Text>
              : null}
          </Box>
        );
      })}
      {plan.contextFiles && plan.contextFiles.length > 0 && (
        <Box marginLeft={1}>
          <Text color="gray" dimColor>Read first: {plan.contextFiles.join(", ")}</Text>
        </Box>
      )}
    </Box>
  );
}

const TASK_STATUS_ICON: Record<Task["status"], string> = {
  pending: "⏳",
  "in-progress": "🔄",
  done: "✅",
  failed: "❌",
};

/** Task plan display — shows plan tasks with live status. */
function TaskPlanDisplay({ plan }: { plan: TaskPlan }) {
  const done = plan.tasks.filter((t) => t.status === "done").length;
  const failed = plan.tasks.filter((t) => t.status === "failed").length;
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="blue" paddingX={1}>
      <Text bold color="blue">📋 Plan: {plan.goal}</Text>
      <Text color="gray">  {done}/{plan.tasks.length} done{failed > 0 ? `, ${failed} failed` : ""}</Text>
      {plan.tasks.map((task) => {
        const icon = TASK_STATUS_ICON[task.status];
        const color =
          task.status === "done" ? "green" :
          task.status === "failed" ? "red" :
          task.status === "in-progress" ? "yellow" : "gray";
        const deps = task.dependsOn.length > 0 ? ` (deps: ${task.dependsOn.join(", ")})` : "";
        return (
          <Box key={task.id} flexDirection="column" marginLeft={1}>
            <Text>
              {icon} <Text color={color}>[{task.id}]</Text> {task.title}{deps}
            </Text>
            <Text color="gray" dimColor>    {task.description}</Text>
            {task.error ? <Text color="red">    Error: {task.error}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}

/** Live streaming message — shown while the assistant is generating text. */
function StreamingMessage({ buffer }: { buffer: string }) {
  if (!buffer) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Markdown>{buffer}</Markdown>
      <Text color="magenta" dimColor>▌</Text>
    </Box>
  );
}

/** Footer bar showing cumulative token usage and cost. */
function Footer({ stats }: { stats: FooterStats }) {
  const formatK = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const modelLabel = stats.model.includes("haiku") ? "⚡ haiku" : stats.model.includes("opus") ? "◆ opus" : "◈ sonnet";
  const costStr = stats.cost < 0.001 ? "<$0.001" : `${stats.cost.toFixed(3)}`;

  // Context budget: color shifts yellow at 70%, red at 90%
  const ctxRatio = stats.contextLimit > 0 ? stats.contextTokens / stats.contextLimit : 0;
  const ctxColor = getContextColor(ctxRatio);
  const ctxPct = Math.round(ctxRatio * 100);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color="gray" dimColor>↑{formatK(stats.tokensIn)} ↓{formatK(stats.tokensOut)}</Text>
        <Text color="green" dimColor>{costStr}</Text>
        <Text color="blueBright" dimColor>{modelLabel}</Text>
      </Box>
      <Box>
        <Text color={ctxColor} dimColor={ctxColor === "gray"}>
          ctx {ctxPct}%  {formatK(stats.contextTokens)}/{formatK(stats.contextLimit)}
        </Text>
      </Box>
    </Box>
  );
}

// ─── Export Helper ───────────────────────────────────────────
function buildExportContent(
  messages: Message[],
  model: string,
  stats: FooterStats,
  workDir: string,
  filePath: string,
): void {
  const exportMsgs = messages.filter(m => m.role === "user" || m.role === "assistant") as import("./export-helper.js").ExportMessage[];
  buildExportContentHelper(exportMsgs, model, { tokensIn: stats.tokensIn, tokensOut: stats.tokensOut, cost: stats.cost }, workDir, filePath);
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [currentModel, setCurrentModel] = useState("sonnet");
  const [streamBuffer, setStreamBuffer] = useState("");
  const [sessionList, setSessionList] = useState<SessionInfo[]>([]);
  const [showResume, setShowResume] = useState(false);
  const [activePlan, setActivePlan] = useState<EditPlan | null>(null);
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  const [contextBudgetRatio, setContextBudgetRatio] = useState(0);
  const [contextWarning, setContextWarning] = useState(false);
  const [externalChanges, setExternalChanges] = useState<string[]>([]);
  const [fileSuggestions, setFileSuggestions] = useState<string[]>([]);
  const [fileSuggestionIdx, setFileSuggestionIdx] = useState(0);
  const repoMapRef = useRef<import("./tree-sitter-map.js").RepoMap | null>(null);
  const [footerStats, setFooterStats] = useState<FooterStats>({
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    model: "sonnet",
    contextTokens: 0,
    contextLimit: 200_000,
  });
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const { exit } = useApp();
  const gitInfo = useGitStatus(workDir);

  // Initialize orchestrator
  useEffect(() => {
    const orch = new Orchestrator({
      workDir,
      resumeSessionPath: initialResumeSessionPath,
      onToolCall: (name, toolInput, _result) => {
        const tm: Message = { role: "tool", content: toolInput, toolName: name };
        setMessages(prev => [...prev, tm]);
      },
      onStatus: (s) => setStatus(s),
      onText: (delta) => {
        // Append delta to streaming buffer for real-time display
        setStreamBuffer(prev => prev + delta);
      },
      onPlan: (plan: EditPlan) => {
        setActivePlan(plan);
      },
      onDiffPreview: noConfirm ? undefined : (diff, filePath) => {
        return new Promise<boolean>((resolve) => {
          setPendingDiff({ diff, filePath, resolve });
        });
      },
      onContextBudget: (ratio) => {
        setContextBudgetRatio(ratio);
      },
      onContextWarning: () => {
        setContextWarning(true);
      },
      onExternalFileChange: (paths) => {
        setExternalChanges(paths);
      },
    });
    orchestratorRef.current = orch;
    orch.init().then(() => {
      if (continueFlag) {
        if (initialResumeSessionPath) {
          setMessages([{
            role: "assistant",
            content: "✓ Resumed most recent session.",
          }]);
        } else {
          setMessages([{
            role: "assistant",
            content: "⚠ No saved sessions found — starting fresh.",
          }]);
        }
      } else {
        // First-run welcome: show onboarding banner if .autoagent.md doesn't exist
        const welcome = shouldShowWelcome(workDir);
        if (welcome) {
          setMessages(prev => [...prev, welcome]);
        }
      }
      setStatus("");
      // Build initial repoMap for #file suggestions
      try {
        const out = execSync(`git -C ${JSON.stringify(workDir)} ls-files`, { encoding: "utf8" });
        const allFiles = out.split("\n").filter(Boolean);
        repoMapRef.current = buildRepoMap(workDir, allFiles);
      } catch { /* non-git repo — suggestions unavailable */ }
    }).catch(() => setStatus("Init failed"));
  }, []);

  // Update file suggestions whenever input changes
  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    const partial = extractFileQuery(val);
    if (partial !== null && repoMapRef.current) {
      const suggs = getFileSuggestions(repoMapRef.current, partial, 5);
      setFileSuggestions(suggs);
      setFileSuggestionIdx(0);
    } else {
      setFileSuggestions([]);
      setFileSuggestionIdx(0);
    }
  }, []);

  // Accept suggestion: replace #partial with the selected file path
  const acceptFileSuggestion = useCallback((path: string) => {
    setInput(prev => {
      const idx = prev.lastIndexOf("#");
      if (idx === -1) return prev;
      return prev.slice(0, idx) + "#" + path + " ";
    });
    setFileSuggestions([]);
    setFileSuggestionIdx(0);
  }, []);

  useInput((ch, key) => {
    if (pendingDiff) {
      if (ch === "y" || ch === "Y" || key.return) {
        pendingDiff.resolve(true);
        setPendingDiff(null);
      } else if (ch === "n" || ch === "N" || key.escape) {
        pendingDiff.resolve(false);
        setPendingDiff(null);
      }
      return;
    }
    // Tab: cycle through / accept file suggestions
    if (key.tab && fileSuggestions.length > 0) {
      const nextIdx = (fileSuggestionIdx + 1) % fileSuggestions.length;
      setFileSuggestionIdx(nextIdx);
      return;
    }
    // Enter when suggestions open: accept highlighted suggestion
    if (key.return && fileSuggestions.length > 0) {
      acceptFileSuggestion(fileSuggestions[fileSuggestionIdx]);
      return;
    }
    if (!loading && (ch === "c" || ch === "C") && externalChanges.length > 0) {
      setExternalChanges([]);
      return;
    }
    if (key.escape) {
      if (fileSuggestions.length > 0) {
        setFileSuggestions([]);
        return;
      }
      if (loading) {
        orchestratorRef.current?.abort();
        return;
      }
      exit();
    }
  });

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput("");

    // Built-in commands
    if (trimmed === "/clear") {
      orchestratorRef.current?.clearHistory();
      setMessages([]);
      setContextWarning(false);
      setFooterStats({ tokensIn: 0, tokensOut: 0, cost: 0, model: currentModel, contextTokens: 0, contextLimit: 200_000 });
      setStatus("Cleared");
      setTimeout(() => setStatus(""), 1000);
      return;
    }
    if (trimmed === "/compact") {
      setStatus("Compacting context...");
      await orchestratorRef.current?.compactNow();
      setMessages(prev => [...prev, { role: "assistant", content: "Context compacted." }]);
      setStatus("");
      return;
    }
    if (trimmed === "/dream") {
      setMessages(prev => [...prev, { role: "assistant", content: "🌙 Running memory consolidation..." }]);
      try {
        const result = await runDream(process.cwd(), new Anthropic());
        setMessages(prev => [...prev, { role: "assistant", content: `🌙 Dream complete: +${result.added} entries, -${result.removed} entries removed.` }]);
      } catch (err: any) {
        setMessages(prev => [...prev, { role: "assistant", content: `Dream failed: ${err.message}` }]);
      }
      return;
    }
    if (trimmed === "/reindex") {
      setStatus("Re-indexing repo...");
      orchestratorRef.current?.reindex();
      // Rebuild repoMap for #file suggestions
      try {
        const { execSync } = await import("child_process");
        const out = execSync(`git -C ${JSON.stringify(workDir)} ls-files`, { encoding: "utf8" });
        const allFiles = out.split("\n").filter(Boolean);
        repoMapRef.current = buildRepoMap(workDir, allFiles);
      } catch { /* ignore */ }
      setStatus("Re-indexed");
      setTimeout(() => setStatus(""), 1000);
      return;
    }
    if (trimmed === "/exit") {
      if (messages.length > 2) {
        try {
          const now = new Date();
          const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const filePath = path.join(workDir, ".autoagent", "exports", `session-${timestamp}.md`);
          const model = orchestratorRef.current?.getModel() ?? footerStats.model;
          buildExportContent(messages, model, footerStats, workDir, filePath);
        } catch { /* never block exit */ }
      }
      exit();
      return;
    }
    if (trimmed === "/init") {
      setStatus("Analyzing project...");
      try {
        const { content, updated } = await runInit(workDir, (msg) => setStatus(msg));
        setStatus("");
        const preview = content.split("\n").slice(0, 20).join("\n");
        const truncated = content.split("\n").length > 20 ? "\n...(truncated)" : "";
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `${updated ? "Updated" : "Created"} .autoagent.md:\n\n\`\`\`markdown\n${preview}${truncated}\n\`\`\``,
        }]);
      } catch (err) {
        setStatus("");
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
        }]);
      }
      return;
    }
    if (trimmed === "/help") {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: [
          `Current model: ${currentModel}`,
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
      }]);
      return;
    }
    if (trimmed === "/rewind") {
      const checkpoints = orchestratorRef.current?.getCheckpoints() ?? [];
      if (checkpoints.length === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: "No checkpoints yet. Send a message first." }]);
        return;
      }
      const lines = ["Conversation checkpoints (select with /rewind <number>):"];
      lines.push("  [0] now (current state)");
      checkpoints.slice().reverse().forEach((cp, i) => {
        const t = new Date(cp.timestamp).toLocaleTimeString();
        lines.push(`  [${i + 1}] "${cp.label}" (${t})`);
      });
      lines.push("\nType /rewind <number> to restore that checkpoint.");
      setMessages(prev => [...prev, { role: "assistant", content: lines.join("\n") }]);
      return;
    }
    const rewindMatch = trimmed.match(/^\/rewind\s+(\d+)$/);
    if (rewindMatch) {
      const idx = parseInt(rewindMatch[1], 10);
      if (idx === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: "Already at current state." }]);
        return;
      }
      const checkpoints = orchestratorRef.current?.getCheckpoints() ?? [];
      const reversed = checkpoints.slice().reverse();
      const cp = reversed[idx - 1];
      if (!cp) {
        setMessages(prev => [...prev, { role: "assistant", content: "Invalid checkpoint number." }]);
        return;
      }
      const result = orchestratorRef.current?.rewindTo(cp.id);
      if (result) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `↩ Rewound to: "${result.label}"`,
        }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Could not rewind to that checkpoint." }]);
      }
      return;
    }
    if (trimmed === "/status") {
      const turns = messages.filter(m => m.role === "user").length;
      const { tokensIn, tokensOut, cost, model } = footerStats;
      const costStr = cost < 0.01 ? `${cost.toFixed(4)}` : `${cost.toFixed(2)}`;
      const stats = orchestratorRef.current?.getSessionStats();
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
      setMessages(prev => [...prev, {
        role: "assistant",
        content: [
          "Session Status:",
          `  Turns:      ${turns}`,
          `  Tokens in:  ${tokensIn.toLocaleString()}`,
          `  Tokens out: ${tokensOut.toLocaleString()}`,
          `  Cost:       ${costStr}`,
          `  Model:      ${model}`,
          ...sessionLines,
        ].join("\n"),
      }]);
      return;
    }
    if (trimmed.startsWith("/find")) {
      const query = trimmed.slice(5).trim();
      if (!query) {
        setMessages(prev => [...prev, { role: "assistant", content: "Usage: /find <query>" }]);
        return;
      }
      try {
        // Get source files for the repo map
        const allFiles = execSync(
          "git ls-files --cached --others --exclude-standard 2>/dev/null || find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' | head -200",
          { cwd: workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
        ).trim().split("\n").filter(Boolean).slice(0, 200);
        const repoMap = buildRepoMap(workDir, allFiles);
        const results = fuzzySearch(repoMap, query, 15);
        if (results.length === 0) {
          setMessages(prev => [...prev, { role: "assistant", content: `No matches for "${query}"` }]);
        } else {
          const lines = results.map(r => {
            if (r.symbol) {
              return `  ${r.file}:${r.line}  ${r.symbol} (${r.kind})  [${(r.score * 100).toFixed(0)}%]`;
            }
            return `  ${r.file}  [${(r.score * 100).toFixed(0)}%]`;
          });
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `🔍 Results for "${query}":\n${lines.join("\n")}`,
          }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: "Search failed — could not build repo map." }]);
      }
      return;
    }
    if (trimmed.startsWith("/search")) {
      const query = trimmed.slice(7).trim();
      if (!query) {
        setMessages(prev => [...prev, { role: "assistant", content: "Usage: /search <query>" }]);
        return;
      }
      try {
        if (_searchIndexHolder.index.fileCount === 0) {
          setMessages(prev => [...prev, { role: "assistant", content: "Building search index…" }]);
          await buildSearchIndex(workDir);
        }
        const results = _searchIndexHolder.index.search(query, 5);
        if (results.length === 0) {
          setMessages(prev => [...prev, { role: "assistant", content: `No results for "${query}"` }]);
        } else {
          const lines = results.map((r, i) =>
            `${i + 1}. ${r.file}:${r.lineStart}-${r.lineEnd}  score=${r.score.toFixed(2)}\n   ${r.snippet.replace(/\n/g, " ").slice(0, 120)}`
          );
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `🔍 Semantic results for "${query}":\n\n${lines.join("\n\n")}`,
          }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, { role: "assistant", content: `Search failed: ${String(err)}` }]);
      }
      return;
    }
    if (trimmed === "/diff") {
      try {
        const isRepo = execSync("git rev-parse --is-inside-work-tree", {
          cwd: workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"],
        }).trim();
        if (isRepo !== "true") throw new Error("not a repo");
        const stat = execSync("git diff --stat", { cwd: workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
        const diff = execSync("git diff", { cwd: workDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
        const combined = [stat, diff].filter(Boolean).join("\n\n");
        if (!combined) {
          setMessages(prev => [...prev, { role: "assistant", content: "No uncommitted changes." }]);
        } else {
          const lines = combined.split("\n");
          const truncated = lines.length > 200 ? lines.slice(0, 200).join("\n") + "\n(truncated)" : combined;
          setMessages(prev => [...prev, { role: "assistant", content: truncated }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: "No uncommitted changes." }]);
      }
      return;
    }
    if (trimmed === "/undo") {
      const result = await undoLastCommit(workDir);
      if (result.undone) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✓ Undid commit ${result.hash}: ${result.message}`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Cannot undo: ${result.error}`,
        }]);
      }
      return;
    }
    if (trimmed.startsWith("/model")) {
      const arg = trimmed.slice(6).trim();
      const MODEL_ALIASES: Record<string, string> = {
        haiku: "claude-haiku-4-5",
        sonnet: "claude-sonnet-4-6",
        opus: "claude-opus-4-5",
      };
      if (!arg) {
        const current = orchestratorRef.current?.getModel() ?? "auto";
        setMessages(prev => [...prev, { role: "assistant", content: `Current model: ${current}` }]);
      } else if (arg === "reset" || arg === "auto") {
        orchestratorRef.current?.setModel(null);
        setCurrentModel("auto");
        setMessages(prev => [...prev, { role: "assistant", content: "Model reset to auto-routing (keyword-based)." }]);
      } else {
        const resolved = MODEL_ALIASES[arg] ?? (arg.startsWith("claude-") ? arg : null);
        if (!resolved) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `Unknown model "${arg}". Use: haiku, sonnet, opus, reset, or a full model ID.`,
          }]);
        } else {
          orchestratorRef.current?.setModel(resolved);
          setCurrentModel(resolved);
          setMessages(prev => [...prev, { role: "assistant", content: `Switched to ${resolved}` }]);
        }
      }
      return;
    }
    if (trimmed === "/resume") {
      const sessions = listSessions(workDir);
      if (sessions.length === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: "No saved sessions found." }]);
      } else {
        setSessionList(sessions);
        setShowResume(true);
        const listing = sessions
          .slice(0, 10)
          .map((s, i) => `  [${i + 1}] ${s.summary} (${s.messageCount} msgs, ${s.updatedAt.toLocaleDateString()})`)
          .join("\n");
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Recent sessions:\n${listing}\n\nType /resume <number> to load a session.`,
        }]);
      }
      return;
    }
    const resumeMatch = trimmed.match(/^\/resume\s+(\d+)$/);
    if (resumeMatch) {
      const idx = parseInt(resumeMatch[1], 10) - 1;
      if (idx >= 0 && idx < sessionList.length) {
        const session = sessionList[idx];
        orchestratorRef.current?.resumeSession(session.path);
        setShowResume(false);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✓ Resumed session: "${session.summary}" (${session.messageCount} messages loaded)`,
        }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Invalid session number." }]);
      }
      return;
    }

    // /plan commands
    if (trimmed === "/plan" || trimmed === "/plan help" || trimmed === "/plan list" || trimmed === "/plan resume" || trimmed.startsWith("/plan ")) {
      const args = trimmed.slice(5).trim(); // everything after "/plan"
      await handlePlanCommand(args, {
        workDir,
        addMessage: (text) => setMessages(prev => [...prev, { role: "assistant", content: text }]),
        execute: async (description) => {
          const res = await orchestratorRef.current!.send(description);
          return res.text ?? "done";
        },
        setLoading,
        setStatus,
      });
      return;
    }

    if (trimmed === "/export" || trimmed.startsWith("/export ")) {
      const arg = trimmed.slice(7).trim();
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = arg || `session-export-${timestamp}.md`;
      const filePath = path.isAbsolute(filename) ? filename : path.join(workDir, filename);
      try {
        const model = orchestratorRef.current?.getModel() ?? footerStats.model;
        buildExportContent(messages, model, footerStats, workDir, filePath);
        setMessages(prev => [...prev, { role: "assistant", content: `Exported to ${filename}` }]);
      } catch (err) {
        setMessages(prev => [...prev, { role: "assistant", content: `Export failed: ${err instanceof Error ? err.message : err}` }]);
      }
      return;
    }

    // Add user message
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);

    setContextWarning(false); // reset warning on new message
    setLoading(true);
    setStatus("Thinking...");
    setStreamBuffer(""); // clear any leftover

    try {
      const result = await orchestratorRef.current!.send(trimmed);

      setCurrentModel(result.model);

      // Flush streaming buffer → final message
      setStreamBuffer("");

      if (result.text) {
        // Cancelled generation — show as neutral system message
        if (result.text.startsWith("⏹")) {
          setMessages(prev => [...prev, { role: "assistant", content: result.text }]);
        } else {
          const assistantMsg: Message = {
            role: "assistant",
            content: result.text,
            tokens: { in: result.tokensIn, out: result.tokensOut },
            model: result.model,
            verificationPassed: result.verificationPassed,
          };
          setMessages(prev => [...prev, assistantMsg]);
        }
      }

      // Show commit info if auto-commit fired
      if (result.commitResult?.committed) {
        const { hash, message } = result.commitResult;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✓ Committed ${hash}: ${message}`,
        }]);
      }

      // Update footer stats from orchestrator
      const costInfo = orchestratorRef.current?.getCost();
      if (costInfo) {
        setFooterStats({
          tokensIn: costInfo.tokensIn,
          tokensOut: costInfo.tokensOut,
          cost: costInfo.cost,
          model: result.model,
          contextTokens: costInfo.lastInputTokens,
          contextLimit: 200_000,
        });
      }

      setStatus("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setStreamBuffer("");
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${errMsg}` }]);
      setStatus("");
    }

    setLoading(false);
  }, [exit, currentModel]);

  return (
    <Box flexDirection="column" padding={1}>
      <Header model={currentModel} git={gitInfo} />

      {/* Message history */}
      <Box flexDirection="column" flexGrow={1}>
        <VirtualMessageList
          messages={messages}
          windowSize={20}
          renderMessage={(msg, i) => <MessageDisplay key={`${msg.role}-${i}`} msg={msg} />}
        />
      </Box>

      {/* Diff preview — shown when agent proposes a file edit */}
      {pendingDiff && (
        <DiffPreviewDisplay diff={pendingDiff.diff} filePath={pendingDiff.filePath} />
      )}

      {/* Live streaming text */}
      {!pendingDiff && streamBuffer && <StreamingMessage buffer={streamBuffer} />}

      {/* Status / spinner */}
      {(loading || status) && (
        <Box marginTop={1}>
          {loading && (
            <Text color="magenta">
              <Spinner type="dots" />
            </Text>
          )}
          <Text color="gray"> {status}</Text>
        </Box>
      )}

      {/* Context budget warning */}
      {contextBudgetRatio >= 0.8 && (
        <Box marginTop={1}>
          <Text color="yellow">⚠ Context {Math.round(contextBudgetRatio * 100)}% full — compaction will trigger soon</Text>
        </Box>
      )}

      {/* Persistent context warning banner from onContextWarning callback */}
      {contextWarning && (
        <Box marginTop={1}>
          <Text color="yellow">⚠ Context 80%+ full — consider /clear or start a new session</Text>
        </Box>
      )}

      {/* #file suggestion overlay */}
      {fileSuggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="cyan">
          <Text color="cyan" bold> File suggestions (Tab=cycle, Enter=accept, Esc=dismiss):</Text>
          {fileSuggestions.map((f, i) => (
            <Text key={f} color={i === fileSuggestionIdx ? "green" : "gray"}>
              {i === fileSuggestionIdx ? "▸ " : "  "}{f}
            </Text>
          ))}
        </Box>
      )}

      {externalChanges.length > 0 && (
        <Box marginTop={1}>
          <Text color="yellow">⚠ External changes: {externalChanges.map(p => path.basename(p)).join(", ")}  [C to clear]</Text>
        </Box>
      )}

      {/* Footer: token + cost stats */}
      <Footer stats={footerStats} />

      {/* Input */}
      {!loading && (
        <Box marginTop={1}>
          <Text color="cyan" bold>❯ </Text>
          <TextInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder="Ask anything..."
          />
        </Box>
      )}
    </Box>
  );
}

// ─── Entry ──────────────────────────────────────────────────

render(<App />);
