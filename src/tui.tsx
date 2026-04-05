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
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import "dotenv/config";
import { createDefaultRegistry } from "./tool-registry.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16384;

// Parse args
let workDir = process.cwd();
const dirIdx = process.argv.indexOf("--dir");
if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
  workDir = path.resolve(process.argv[dirIdx + 1]);
}

const client = new Anthropic();
const registry = createDefaultRegistry();
const tools = registry.getDefinitions();

const SYSTEM = `You are a coding assistant with direct access to the filesystem and shell.

Working directory: ${workDir}

You have these tools: ${registry.getNames().join(", ")}

Rules:
- Be concise. Do the thing, show the result.
- Use bash for commands, read_file/write_file for files, grep for search.
- If the user asks you to do something, do it. Don't ask for confirmation.`;

// ─── Types ──────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  tokens?: { in: number; out: number };
}

// ─── Tool execution ─────────────────────────────────────────

async function execTool(name: string, input: Record<string, unknown>): Promise<string> {
  const tool = registry.get(name);
  if (!tool) return `Unknown tool: ${name}`;
  const ctx = {
    rootDir: workDir,
    log: () => {},
    defaultTimeout: tool.defaultTimeout,
  };
  try {
    const { result } = await tool.handler(input, ctx);
    return result;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : err}`;
  }
}

// ─── Agent loop ─────────────────────────────────────────────

async function runAgent(
  apiMessages: Anthropic.MessageParam[],
  onToolCall: (name: string, input: string, result: string) => void,
  onText: (text: string) => void,
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  let totalIn = 0, totalOut = 0;
  let fullText = "";

  const maxRounds = 25;
  for (let round = 0; round < maxRounds; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      tools,
      messages: apiMessages,
    });

    totalIn += response.usage?.input_tokens ?? 0;
    totalOut += response.usage?.output_tokens ?? 0;

    apiMessages.push({ role: "assistant", content: response.content });

    // Collect text
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        fullText += (fullText ? "\n" : "") + block.text;
        onText(block.text);
      }
    }

    // Tool calls
    const toolUses = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use"
    );

    if (toolUses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const inputStr = tu.name === "bash"
        ? (tu.input as { command?: string }).command ?? JSON.stringify(tu.input)
        : JSON.stringify(tu.input).slice(0, 120);
      const result = await execTool(tu.name, tu.input);
      onToolCall(tu.name, inputStr, result);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    apiMessages.push({ role: "user", content: results });

    if (response.stop_reason === "end_turn") break;
  }

  return { text: fullText, tokensIn: totalIn, tokensOut: totalOut };
}

// ─── Components ─────────────────────────────────────────────

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">⚡ AutoAgent CLI</Text>
        <Text color="gray"> — {MODEL}</Text>
      </Box>
      <Text color="gray" dimColor>
        {workDir}
      </Text>
      <Text color="gray" dimColor>
        Tools: {registry.getNames().join(" · ")}
      </Text>
    </Box>
  );
}

function ToolCallDisplay({ name, input, result }: { name: string; input: string; result: string }) {
  const preview = result.split("\n").slice(0, 2).join(" ").slice(0, 120);
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text>
        <Text color="yellow" dimColor>▸ </Text>
        <Text color="yellow">{name}</Text>
        <Text color="gray"> {input.slice(0, 80)}{input.length > 80 ? "…" : ""}</Text>
      </Text>
      {preview && (
        <Text color="gray" dimColor wrap="truncate-end">  → {preview}</Text>
      )}
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
        result=""
      />
    );
  }
  // assistant
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{msg.content}</Text>
      {msg.tokens && (
        <Text color="gray" dimColor>
          ({msg.tokens.in.toLocaleString()} in / {msg.tokens.out.toLocaleString()} out)
        </Text>
      )}
    </Box>
  );
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const apiMessages = useRef<Anthropic.MessageParam[]>([]);
  const { exit } = useApp();

  useInput((_, key) => {
    if (key.escape) exit();
  });

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput("");

    if (trimmed === "/clear") {
      setMessages([]);
      apiMessages.current = [];
      setStatus("Cleared");
      return;
    }

    if (trimmed === "/exit") {
      exit();
      return;
    }

    // Add user message
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    apiMessages.current.push({ role: "user", content: trimmed });

    setLoading(true);
    setStatus("Thinking...");

    try {
      const toolMessages: Message[] = [];

      const { text, tokensIn, tokensOut } = await runAgent(
        apiMessages.current,
        (name, toolInput, _result) => {
          const tm: Message = { role: "tool", content: toolInput, toolName: name };
          toolMessages.push(tm);
          setMessages(prev => [...prev, tm]);
          setStatus(`Running ${name}...`);
        },
        (_text) => {
          setStatus("Responding...");
        },
      );

      if (text) {
        const assistantMsg: Message = {
          role: "assistant",
          content: text,
          tokens: { in: tokensIn, out: tokensOut },
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
      <Header />

      {/* Message history */}
      <Box flexDirection="column" flexGrow={1}>
        {messages.map((msg, i) => (
          <MessageDisplay key={`${msg.role}-${i}`} msg={msg} />
        ))}
      </Box>

      {/* Status / spinner */}
      {loading && (
        <Box marginTop={1}>
          <Text color="magenta">
            <Spinner type="dots" />
          </Text>
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
            placeholder="Ask anything... (/clear, /exit, Esc)"
          />
        </Box>
      )}
    </Box>
  );
}

// ─── Entry ──────────────────────────────────────────────────

render(<App />);
