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
import { undoLastCommit } from "./auto-commit.js";
import { buildRepoMap, fuzzySearch } from "./tree-sitter-map.js";
import { execSync } from "child_process";

// Parse args
let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
}

// --no-confirm flag: skip write_file diff confirmation
const noConfirm = process.argv.includes("--no-confirm");

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
}

// ─── Components ─────────────────────────────────────────────

function Header({ model }: { model: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">⚡ AutoAgent</Text>
        <Text color="gray"> — {model}</Text>
      </Box>
      <Text color="gray" dimColor>
        {workDir}
      </Text>
      <Text color="gray" dimColor>
        Commands: /help  /clear  /reindex  /diff  /undo  /exit  Esc
      </Text>
    </Box>
  );
}

function ToolCallDisplay({ name, input }: { name: string; input: string }) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text>
        <Text color="yellow" dimColor>▸ </Text>
        <Text color="yellow">{name}</Text>
        <Text color="gray"> {input.slice(0, 90)}{input.length > 90 ? "…" : ""}</Text>
      </Text>
    </Box>
  );
}

function MessageDisplay({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <Box marginTop={1}>
        <Text color="cyan" bold>❯ </Text>
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
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{msg.content}</Text>
      <Box>
        {msg.tokens && (
          <Text color="gray" dimColor>
            ({msg.tokens.in.toLocaleString()} in / {msg.tokens.out.toLocaleString()} out)
          </Text>
        )}
        {msg.model && (
          <Text color="gray" dimColor>
            {msg.tokens ? "  " : ""}{msg.model.includes("haiku") ? "⚡ haiku" : "◈ sonnet"}
          </Text>
        )}
        {msg.verificationPassed === true && (
          <Text color="green" dimColor>  ✓ verified</Text>
        )}
        {msg.verificationPassed === false && (
          <Text color="red" dimColor>  ✗ verify failed</Text>
        )}
      </Box>
    </Box>
  );
}

/** Diff preview display — shown when agent proposes a file edit. */
function DiffPreviewDisplay({ diff, filePath }: { diff: string; filePath: string }) {
  const lines = diff.split("\n");
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
      <Text bold>📝 {filePath}</Text>
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

/** Live streaming message — shown while the assistant is generating text. */
function StreamingMessage({ buffer }: { buffer: string }) {
  if (!buffer) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{buffer}</Text>
      <Text color="magenta" dimColor>▌</Text>
    </Box>
  );
}

/** Footer bar showing cumulative token usage and cost. */
function Footer({ stats }: { stats: FooterStats }) {
  const formatK = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const modelLabel = stats.model.includes("haiku") ? "haiku" : "sonnet";
  const costStr = stats.cost < 0.001 ? "<$0.001" : `~$${stats.cost.toFixed(3)}`;

  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray" dimColor>
        Tokens: {formatK(stats.tokensIn)} in / {formatK(stats.tokensOut)} out
        {"  |  "}Cost: {costStr}
        {"  |  "}Model: {modelLabel}
      </Text>
    </Box>
  );
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
  const [footerStats, setFooterStats] = useState<FooterStats>({
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    model: "sonnet",
  });
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const { exit } = useApp();

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
      }
      setStatus("");
    }).catch(() => setStatus("Init failed"));
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
    if (key.escape) exit();
  });

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput("");

    // Built-in commands
    if (trimmed === "/clear") {
      orchestratorRef.current?.clearHistory();
      setMessages([]);
      setFooterStats({ tokensIn: 0, tokensOut: 0, cost: 0, model: currentModel });
      setStatus("Cleared");
      setTimeout(() => setStatus(""), 1000);
      return;
    }
    if (trimmed === "/reindex") {
      setStatus("Re-indexing repo...");
      orchestratorRef.current?.reindex();
      setStatus("Re-indexed");
      setTimeout(() => setStatus(""), 1000);
      return;
    }
    if (trimmed === "/exit") {
      exit();
      return;
    }
    if (trimmed === "/help") {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: [
          "Available commands:",
          "  /help     — Show this help message",
          "  /find Q   — Fuzzy search files & symbols in the repo",
          "  /clear    — Clear the conversation history",
          "  /reindex  — Re-index the repository files",
          "  /resume   — List and restore a previous session",
          "  /diff     — Show uncommitted git changes",
          "  /undo     — Revert the last autoagent commit",
          "  /exit     — Quit AutoAgent",
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

    // Add user message
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);
    setStatus("Thinking...");
    setStreamBuffer(""); // clear any leftover

    try {
      const result = await orchestratorRef.current!.send(trimmed);

      setCurrentModel(result.model);

      // Flush streaming buffer → final message
      setStreamBuffer("");

      if (result.text) {
        const assistantMsg: Message = {
          role: "assistant",
          content: result.text,
          tokens: { in: result.tokensIn, out: result.tokensOut },
          model: result.model,
          verificationPassed: result.verificationPassed,
        };
        setMessages(prev => [...prev, assistantMsg]);
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
      <Header model={currentModel} />

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

      {/* Footer: token + cost stats */}
      <Footer stats={footerStats} />

      {/* Input */}
      {!loading && (
        <Box marginTop={1}>
          <Text color="cyan" bold>❯ </Text>
          <TextInput
            value={input}
            onChange={setInput}
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
