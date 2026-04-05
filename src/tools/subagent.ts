/**
 * Sub-agent tool — spawn a cheaper/faster model for delegated tasks.
 *
 * Use cases: research, summarization, code review, brainstorming,
 * validation, or any task that doesn't need Opus-level reasoning.
 *
 * This is the "Society of Mind" pattern — multiple cheap specialists
 * coordinated by one expensive generalist.
 */

import Anthropic from "@anthropic-ai/sdk";
const MODELS: Record<string, string> = {
  fast: "claude-haiku-4-5-20251001",
  balanced: "claude-sonnet-4-6",
};

export const subagentToolDefinition: Anthropic.Tool = {
  name: "subagent",
  description:
    "Spawn a sub-agent (cheaper/faster model) to handle a delegated task. " +
    "Use this for research, summarization, code review, brainstorming, or any " +
    "work that doesn't need your full reasoning power. " +
    "Models: 'fast' (Haiku — very cheap, good for simple tasks) or " +
    "'balanced' (Sonnet — moderate cost, good for code review and analysis). " +
    "The sub-agent sees only the prompt you give it — no conversation history. " +
    "You can include file contents or context in the prompt.",
  input_schema: {
    type: "object" as const,
    properties: {
      task: {
        type: "string",
        description: "Clear description of what the sub-agent should do. Include any context it needs — it has no access to your conversation or files.",
      },
      model: {
        type: "string",
        enum: ["fast", "balanced"],
        description: "'fast' = Haiku (cheapest, simple tasks). 'balanced' = Sonnet (code review, analysis). Default: 'fast'.",
      },
      max_tokens: {
        type: "integer",
        description: "Max output tokens for the sub-agent. Default: 2048.",
      },
    },
    required: ["task"],
  },
};

export interface SubagentResult {
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function executeSubagent(
  task: string,
  model: string = "fast",
  maxTokens: number = 2048,
): Promise<SubagentResult> {
  const modelId = MODELS[model] || MODELS.fast;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: task }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return {
      response: text,
      model: modelId,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      response: `ERROR: ${msg}`,
      model: modelId,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}

