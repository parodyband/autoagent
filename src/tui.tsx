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

// Parse args
let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
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

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  tokens?: { in: number; out: number };
  model?: string;
  verificationPassed?: boolean;
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
        Commands: /clear  /reindex  /exit  Esc
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

  useInput((_, key) => {
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
        {messages.map((msg, i) => (
          <MessageDisplay key={`${msg.role}-${i}`} msg={msg} />
        ))}
      </Box>

      {/* Live streaming text */}
      {streamBuffer && <StreamingMessage buffer={streamBuffer} />}

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
