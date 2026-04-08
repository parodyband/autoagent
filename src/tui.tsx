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
import "dotenv/config";
import { Orchestrator } from "./orchestrator.js";
import { listSessions, type SessionInfo } from "./session-store.js";
import type { EditPlan } from "./architect-mode.js";
import { VirtualMessageList } from "./virtual-message-list.js";
import { buildRepoMap, fuzzySearch } from "./tree-sitter-map.js";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { runInit } from "./init-command.js";
import { useContextBudget, useStreaming, useFileSuggestions } from "./hooks/index.js";
import { TuiErrorBoundary } from "./error-boundary.js";

const execAsync = promisify(exec);
import { shouldShowWelcome } from "./welcome.js";
import type { Task, TaskPlan } from "./task-planner.js";
import { Markdown } from "./markdown-renderer.js";
import { routeCommand, type FooterStats } from "./tui-commands.js";

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

// FooterStats imported from tui-commands.ts

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
    let active = true;
    async function poll() {
      try {
        const { stdout: branchOut } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: dir });
        const branch = branchOut.trim();
        const { stdout: statusOut } = await execAsync("git status --short", { cwd: dir });
        const lines = statusOut.split("\n").filter(l => l.trim().length > 0);
        // XY format: first char = staged, second = unstaged/untracked
        const staged = lines.filter(l => l[0] && l[0] !== " " && l[0] !== "?").length;
        const unstaged = lines.filter(l => l[1] && (l[1] !== " ")).length;
        if (active) setInfo({ branch, changedCount: unstaged, stagedCount: staged, isRepo: true });
      } catch {
        if (active) setInfo({ branch: "", changedCount: 0, stagedCount: 0, isRepo: false });
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { active = false; clearInterval(id); };
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

function ContextIndicator({ tokensUsed, threshold }: { tokensUsed: number; threshold: number }) {
  const percent = Math.round((tokensUsed / threshold) * 100);
  const usedK = Math.round(tokensUsed / 1000);
  const thresholdK = Math.round(threshold / 1000);
  const color = percent >= 80 ? "red" : percent >= 50 ? "yellow" : "green";
  return (
    <Text color={color} dimColor={percent < 50}>ctx: {usedK}K/{thresholdK}K ({percent}%)</Text>
  );
}

function Header({ model, git, cost, contextUsage, autoAccept }: { model: string; git: GitInfo; cost?: number; contextUsage?: { tokensUsed: number; threshold: number }; autoAccept?: boolean }) {
  const modelLabel = model.includes("haiku") ? "haiku" : model.includes("opus") ? "opus" : "sonnet";
  const costStr = cost != null ? (cost < 0.01 ? "<$0.01" : `${cost.toFixed(2)}`) : "";
  return (
    <Box marginBottom={1} justifyContent="space-between">
      <Box>
        <Text bold color="white">autoagent</Text>
        <Text color="gray"> / </Text>
        <Text color="cyan">{path.basename(workDir)}</Text>
        <Text color="gray"> / </Text>
        <Text color="blueBright">{modelLabel}</Text>
        <GitBadge git={git} />
      </Box>
      <Box gap={2}>
        {autoAccept && <Text color="green" dimColor>auto</Text>}
        {contextUsage && contextUsage.tokensUsed > 0
          ? <ContextIndicator tokensUsed={contextUsage.tokensUsed} threshold={contextUsage.threshold} />
          : null}
        {costStr ? <Text color="gray" dimColor>{costStr}</Text> : null}
        <Text color="gray" dimColor>/help</Text>
      </Box>
    </Box>
  );
}

function ToolCallDisplay({ name, input }: { name: string; input: string }) {
  return (
    <Box marginLeft={4}>
      <Text color="gray" dimColor>{"  "}▸ {name} </Text>
      <Text color="gray" dimColor>{input.slice(0, 60)}{input.length > 60 ? "…" : ""}</Text>
    </Box>
  );
}

function MessageDisplay({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <Box marginTop={1}>
        <Text color="cyan" bold>{">"} </Text>
        <Text bold>{msg.content}</Text>
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
  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      <Markdown>{msg.content}</Markdown>
      {msg.verificationPassed === true && <Text color="green"> ✓ tests passed</Text>}
      {msg.verificationPassed === false && <Text color="red"> ✗ tests failed</Text>}
    </Box>
  );
}

/** Diff preview display — compact summary with expandable detail. */
function DiffPreviewDisplay({ diff, filePath }: { diff: string; filePath: string }) {
  const allLines = diff.split("\n");
  const added = allLines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
  const removed = allLines.filter(l => l.startsWith("-") && !l.startsWith("---")).length;
  const isBatch = /^\d+ files$/.test(filePath);
  const header = isBatch ? filePath : path.basename(filePath);
  // Show only hunk headers + changed lines (max ~15 lines)
  const preview: { line: string; idx: number }[] = [];
  for (let i = 0; i < allLines.length && preview.length < 15; i++) {
    const l = allLines[i];
    if (l.startsWith("@@") || l.startsWith("+") || l.startsWith("-")) {
      if (l.startsWith("---") || l.startsWith("+++")) continue;
      preview.push({ line: l, idx: i });
    }
  }
  const truncated = allLines.length > 15 && preview.length >= 15;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
      <Box>
        <Text bold color="yellow">✏️  {header} </Text>
        <Text color="green" dimColor>{added > 0 ? `+${added}` : ""}</Text>
        {added > 0 && removed > 0 && <Text color="gray" dimColor> </Text>}
        <Text color="red" dimColor>{removed > 0 ? `-${removed}` : ""}</Text>
        {!isBatch && filePath.includes("/") && <Text color="gray" dimColor> {path.dirname(filePath)}/</Text>}
      </Box>
      {preview.map(({ line, idx }) => {
        if (line.startsWith("@@")) return <Text key={idx} color="cyan" dimColor>{line}</Text>;
        if (line.startsWith("+")) return <Text key={idx} color="green">{line}</Text>;
        if (line.startsWith("-")) return <Text key={idx} color="red">{line}</Text>;
        return <Text key={idx}>{line}</Text>;
      })}
      {truncated && <Text color="gray" dimColor>  … {allLines.length - 15} more lines</Text>}
      <Text bold color="yellow">[Y]es / [n]o</Text>
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
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      <Markdown>{buffer}</Markdown>
      <Text color="gray">▌</Text>
    </Box>
  );
}


function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentModel, setCurrentModel] = useState("sonnet");
  const [sessionList, setSessionList] = useState<SessionInfo[]>([]);
  const [activePlan, setActivePlan] = useState<EditPlan | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  const [autoAccept, setAutoAccept] = useState(noConfirm);
  const [externalChanges, setExternalChanges] = useState<string[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [footerStats, setFooterStats] = useState<FooterStats>({
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    model: "sonnet",
    contextTokens: 0,
    contextLimit: 200_000,
  });
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const autoAcceptRef = useRef(noConfirm);
  const { exit } = useApp();
  const gitInfo = useGitStatus(workDir);

  // Extracted hooks
  const { streamBuffer, setStreamBuffer, loading, setLoading, status, setStatus } = useStreaming();
  const { contextBudgetRatio, setContextBudgetRatio, contextWarning, setContextWarning } = useContextBudget();
  const {
    fileSuggestions, fileSuggestionIdx, setFileSuggestionIdx,
    repoMapRef, handleInputChange: onFileInput, acceptFileSuggestion, dismissSuggestions,
  } = useFileSuggestions({ workDir, setInput: (fn) => setInput(fn) });

  // Keep autoAccept ref in sync with state
  useEffect(() => { autoAcceptRef.current = autoAccept; }, [autoAccept]);

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
      onDiffPreview: (diff, filePath) => {
        // Check autoAccept at call time via ref
        if (autoAcceptRef.current) return Promise.resolve(true);
        return new Promise<boolean>((resolve) => {
          setPendingDiff({ diff, filePath, resolve });
        });
      },
      onContextBudget: (ratio) => {
        setContextBudgetRatio(ratio);
        // Update footer stats live during tool loops so context counter stays current
        setFooterStats(prev => ({
          ...prev,
          contextTokens: Math.round(ratio * prev.contextLimit),
        }));
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
    }).catch(() => setStatus("Init failed"));
  }, []);

  // Wrap file suggestion handler to also set input
  const handleInputChange = useCallback((val: string) => {
    onFileInput(val, setInput);
  }, [onFileInput]);

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
    // Scroll-back: Up/Down arrow when input is empty and not loading
    // Shift+arrow or pageUp/pageDown for larger jumps
    if (key.upArrow && !loading && input === "") {
      const step = key.shift ? 15 : 3;
      setScrollOffset(prev => Math.min(prev + step, Math.max(0, messages.length)));
      return;
    }
    if (key.downArrow && !loading && input === "") {
      const step = key.shift ? 15 : 3;
      setScrollOffset(prev => Math.max(prev - step, 0));
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
        dismissSuggestions();
        return;
      }
      if (loading) {
        orchestratorRef.current?.abort();
        return;
      }
      if (confirmExit) {
        exit();
      } else {
        setConfirmExit(true);
        // Auto-dismiss after 3 seconds
        setTimeout(() => setConfirmExit(false), 3000);
      }
    }
  });

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput("");
    setConfirmExit(false); // dismiss exit prompt on any input

    // Route slash commands to extracted handlers
    if (trimmed.startsWith("/")) {
      const ctx = {
        workDir,
        orchestratorRef,
        messages,
        addMessage: (msg: Message) => setMessages(prev => [...prev, msg]),
        setMessages,
        setStatus,
        setLoading,
        currentModel,
        setCurrentModel,
        footerStats,
        setFooterStats,
        setContextWarning,
        repoMapRef,
        sessionList,
        setSessionList,
        autoAccept,
        setAutoAccept,
        exit,
      };
      const handled = await routeCommand(trimmed, ctx);
      if (handled) return;
      // Unknown command — fall through to send as regular message
    }

    // Add user message
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);

    setContextWarning(false); // reset warning on new message
    setScrollOffset(0); // snap to bottom on new message
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
          contextLimit: costInfo.contextLimit,
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

  // Only show the last assistant exchange + current, auto-clear old noise
  const displayMessages = React.useMemo(() => {
    // Keep only the last few meaningful messages for a clean view
    // When not scrolled: show last user message + its response + tool calls
    if (scrollOffset > 0) return messages; // show all when scrolling
    // Find the last user message index
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return messages;
    // Show everything from last user message onward, plus one prior assistant for context
    let startIdx = lastUserIdx;
    for (let i = lastUserIdx - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") { startIdx = i; break; }
    }
    return messages.slice(startIdx);
  }, [messages, scrollOffset]);

  // Context budget as a compact string for the status line
  const ctxRatio = footerStats.contextLimit > 0 ? footerStats.contextTokens / footerStats.contextLimit : 0;
  const ctxWarningText = ctxRatio >= 0.8
    ? ` · ctx ${Math.round(ctxRatio * 100)}%`
    : "";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header model={currentModel} git={gitInfo} cost={footerStats.cost} contextUsage={footerStats.contextTokens > 0 ? { tokensUsed: footerStats.contextTokens, threshold: footerStats.contextLimit } : undefined} autoAccept={autoAccept} />

      {/* Messages — clean, auto-cleared view */}
      <Box flexDirection="column" flexGrow={1}>
        <VirtualMessageList
          messages={displayMessages}
          windowSize={30}
          scrollOffset={scrollOffset}
          renderMessage={(msg, i) => <MessageDisplay key={`${msg.role}-${i}`} msg={msg} />}
        />
      </Box>

      {/* Architect plan */}
      {activePlan && <PlanDisplay plan={activePlan} />}

      {/* Diff preview */}
      {pendingDiff && (
        <DiffPreviewDisplay diff={pendingDiff.diff} filePath={pendingDiff.filePath} />
      )}

      {/* Streaming */}
      {!pendingDiff && streamBuffer && <StreamingMessage buffer={streamBuffer} />}

      {/* Status line — single compact line for spinner + context warning */}
      {(loading || status) && (
        <Box marginTop={1} paddingLeft={2}>
          {loading && <Text color="gray"><Spinner type="dots" /> </Text>}
          <Text color="gray" dimColor>{status}{ctxWarningText}</Text>
        </Box>
      )}

      {/* File suggestions — minimal */}
      {fileSuggestions.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {fileSuggestions.map((f, i) => (
            <Text key={f} color={i === fileSuggestionIdx ? "cyan" : "gray"} dimColor={i !== fileSuggestionIdx}>
              {i === fileSuggestionIdx ? "▸ " : "  "}{f}
            </Text>
          ))}
        </Box>
      )}

      {/* Inline warnings — only one at a time, prioritized */}
      {confirmExit ? (
        <Box paddingLeft={2}><Text color="yellow">Press Esc again to exit</Text></Box>
      ) : externalChanges.length > 0 ? (
        <Box paddingLeft={2}><Text color="gray" dimColor>Files changed externally: {externalChanges.map(p => path.basename(p)).join(", ")}</Text></Box>
      ) : scrollOffset > 0 ? (
        <Box paddingLeft={2}><Text color="gray" dimColor>↑{scrollOffset} — ↓ to return · shift+arrow for fast scroll</Text></Box>
      ) : contextWarning ? (
        <Box paddingLeft={2}><Text color="yellow" dimColor>Context 80%+ — /clear or start new session</Text></Box>
      ) : null}

      {/* Input */}
      <Box marginTop={1}>
        <Text color={loading ? "gray" : "cyan"} bold dimColor={loading}>{">"} </Text>
        {loading ? (
          <Text color="gray" dimColor></Text>
        ) : (
          <TextInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder=""
          />
        )}
      </Box>
    </Box>
  );
}

// ─── Entry ──────────────────────────────────────────────────

render(<TuiErrorBoundary><App /></TuiErrorBoundary>);
