/**
 * API retry with exponential backoff for Anthropic API calls.
 *
 * Retries on transient errors: 429, 529, 502, 503, network errors.
 * Does NOT retry on: 400, 401, 403, 404 (client errors that won't self-resolve).
 */

import Anthropic from "@anthropic-ai/sdk";

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 529]);
const DEFAULT_MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MULTIPLIER = 4;

/**
 * Returns true if the error is transient and worth retrying.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return RETRYABLE_STATUS_CODES.has(err.status);
  }
  // Network errors (no status code): ECONNRESET, ETIMEDOUT, fetch failures
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused") ||
      msg.includes("network") ||
      msg.includes("fetch failed") ||
      msg.includes("socket hang up")
    );
  }
  return false;
}

/**
 * Call the Anthropic messages API with exponential backoff retry.
 *
 * @param client  - Anthropic client instance
 * @param params  - Message creation params
 * @param maxRetries - Max retry attempts (default 3). Total attempts = maxRetries + 1.
 */
export async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParams,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<Anthropic.Message> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params) as Anthropic.Message;
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxRetries) {
        throw err;
      }

      const delayMs = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
      const status = err instanceof Anthropic.APIError ? ` (status ${err.status})` : "";
      console.error(
        `[api-retry] Attempt ${attempt + 1}/${maxRetries + 1} failed${status}. Retrying in ${delayMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
