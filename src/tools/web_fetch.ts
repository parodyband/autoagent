/**
 * web_fetch tool — fetch a URL and return its content.
 */

import type Anthropic from "@anthropic-ai/sdk";

export const webFetchToolDefinition: Anthropic.Tool = {
  name: "web_fetch",
  description:
    "Fetch a URL and return its content. Useful for reading web pages, APIs, documentation. " +
    "Set extract_text=true to strip HTML tags. Timeout: 30s. Max: 500KB.",
  input_schema: {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "The URL to fetch." },
      extract_text: { type: "boolean", description: "Strip HTML tags for readability. Default: false." },
      headers: { type: "object", description: "Optional additional HTTP headers." },
    },
    required: ["url"],
  },
};

export interface WebFetchResult {
  content: string;
  success: boolean;
  statusCode?: number;
  contentType?: string;
}

function stripHtml(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export async function executeWebFetch(
  url: string,
  extractText: boolean = false,
  headers?: Record<string, string>
): Promise<WebFetchResult> {
  const MAX_SIZE = 500_000;
  const TIMEOUT = 30_000;

  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { content: `ERROR: Only http/https supported. Got: ${parsedUrl.protocol}`, success: false };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AutoAgent/1.0", ...headers },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "unknown";
    let content = await response.text();
    if (content.length > MAX_SIZE) {
      content = content.slice(0, MAX_SIZE) + `\n... [truncated, ${content.length} total chars]`;
    }
    if (extractText && contentType.includes("html")) {
      content = stripHtml(content);
    }

    return { content, success: response.ok, statusCode: response.status, contentType };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) return { content: `ERROR: Timed out after ${TIMEOUT / 1000}s`, success: false };
    return { content: `ERROR: ${msg}`, success: false };
  }
}
