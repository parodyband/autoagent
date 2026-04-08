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

/** Timeout in milliseconds per model tier. */
const TIMEOUTS_MS: Record<string, number> = {
  fast: 60_000,
  balanced: 120_000,
};

/** Max output characters before truncation. */
const MAX_OUTPUT_CHARS = 4096;

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

/** Return true if the error is a transient one worth retrying. */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // AbortError from timeout — not retryable
    if (err.name === "AbortError") return false;
    // Network errors
    if (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("ECONNRESET")) {
      return true;
    }
  }
  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    return status >= 500 || status === 429;
  }
  return false;
}

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Truncate output to MAX_OUTPUT_CHARS with a trailing marker. */
function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_OUTPUT_CHARS) + `\n[truncated — showing first ${MAX_OUTPUT_CHARS} chars]`;
}

export async function executeSubagent(
  task: string,
  model: string = "fast",
  maxTokens: number = 2048,
  client?: Anthropic,
  systemPromptPrefix?: string,
): Promise<SubagentResult> {
  const modelId = MODELS[model] || MODELS.fast;
  const timeoutMs = TIMEOUTS_MS[model] ?? TIMEOUTS_MS.fast;
  const _client = client ?? new Anthropic();

  const MAX_RETRIES = 2;
  const BACKOFF_MS = [1_000, 3_000];

  // Build system prompt array with cache_control to share cache prefix
  const systemBlocks: Anthropic.TextBlockParam[] = systemPromptPrefix
    ? [{ type: "text", text: systemPromptPrefix, cache_control: { type: "ephemeral" } }]
    : [];

  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await _client.messages.create(
        {
          model: modelId,
          max_tokens: maxTokens,
          ...(systemBlocks.length > 0 ? { system: systemBlocks } : {}),
          messages: [{ role: "user", content: task }],
        },
        { signal: controller.signal },
      );

      clearTimeout(timer);

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return {
        response: truncateOutput(text),
        model: modelId,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      };
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;

      // Timeout — don't retry
      if (err instanceof Error && err.name === "AbortError") {
        return {
          response: `ERROR: Sub-agent timed out after ${timeoutMs / 1000}s`,
          model: modelId,
          inputTokens: 0,
          outputTokens: 0,
        };
      }

      // Retryable errors — back off and try again
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        await sleep(BACKOFF_MS[attempt] ?? 1_000);
        continue;
      }

      break;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  return {
    response: `ERROR: ${msg}`,
    model: modelId,
    inputTokens: 0,
    outputTokens: 0,
  };
}

export interface ParallelResearchResult {
  question: string;
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Dispatch multiple research questions concurrently via Promise.all.
 * Each question is sent to a sub-agent independently; results are
 * returned in the same order as the input array.
 */
export async function parallelResearch(
  questions: string[],
  model: string = "fast",
  maxTokens: number = 2048,
  client?: Anthropic,
  systemPromptPrefix?: string,
): Promise<ParallelResearchResult[]> {
  const results = await Promise.all(
    questions.map(async (question) => {
      const result = await executeSubagent(question, model, maxTokens, client, systemPromptPrefix);
      return {
        question,
        response: result.response,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    }),
  );
  return results;
}
