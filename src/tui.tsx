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

// Parse args
let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
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

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [currentModel, setCurrentModel] = useState("sonnet");
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const { exit } = useApp();

  // Initialize orchestrator
  useEffect(() => {
    const orch = new Orchestrator({
      workDir,
      onToolCall: (name, toolInput, _result) => {
        const tm: Message = { role: "tool", content: toolInput, toolName: name };
        setMessages(prev => [...prev, tm]);
      },
      onStatus: (s) => setStatus(s),
      onText: (_text) => setStatus("Responding..."),
    });
    orchestratorRef.current = orch;
    orch.init().then(() => setStatus("")).catch(() => setStatus("Init failed"));
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

    // Add user message
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);
    setStatus("Thinking...");

    try {
      const result = await orchestratorRef.current!.send(trimmed);

      setCurrentModel(result.model);

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
      setStatus("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${errMsg}` }]);
      setStatus("");
    }

    setLoading(false);
  }, [exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Header model={currentModel} />

      {/* Message history */}
      <Box flexDirection="column" flexGrow={1}>
        {messages.map((msg, i) => (
          <MessageDisplay key={`${msg.role}-${i}`} msg={msg} />
        ))}
      </Box>

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
