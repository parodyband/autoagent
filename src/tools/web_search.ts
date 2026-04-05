/**
 * Web search tool — search the web for information using DuckDuckGo.
 *
 * This gives the agent the ability to research techniques, read docs,
 * find papers, look at how other projects solve problems, etc.
 * Uses DuckDuckGo HTML search (no API key needed).
 */

import type Anthropic from "@anthropic-ai/sdk";

export const webSearchToolDefinition: Anthropic.Tool = {
  name: "web_search",
  description:
    "Search the web using DuckDuckGo. Returns titles, URLs, and snippets. " +
    "Use this to research techniques, find documentation, look at how other " +
    "projects solve problems, find papers and blog posts. " +
    "Follow up with web_fetch on interesting URLs to read the full content.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query. Be specific — include language/framework names.",
      },
      max_results: {
        type: "integer",
        description: "Max results to return. Default: 8.",
      },
    },
    required: ["query"],
  },
};

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResult {
  results: SearchResult[];
  content: string;
  success: boolean;
}

function extractResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML results are in <a class="result__a"> tags
  // with snippets in <a class="result__snippet"> tags
  // This is a rough parser — DDG's HTML structure can change

  // Try the result blocks
  const resultBlocks = html.split(/class="result /);

  for (const block of resultBlocks.slice(1)) { // skip first (before any result)
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span)/);

    if (titleMatch) {
      let url = titleMatch[1];
      // DDG wraps URLs in a redirect — extract the actual URL
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }

      const title = titleMatch[2].replace(/<[^>]+>/g, "").trim();
      const snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim()
        : "";

      if (title && url.startsWith("http")) {
        results.push({ title, url, snippet });
      }
    }
  }

  // Fallback: try extracting any links that look like search results
  if (results.length === 0) {
    const linkRegex = /<a[^>]*href="(https?:\/\/(?!duckduckgo)[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null && results.length < 10) {
      const url = match[1];
      const title = match[2].trim();
      if (title.length > 5 && !url.includes("duckduckgo.com")) {
        results.push({ title, url, snippet: "" });
      }
    }
  }

  return results;
}

export async function executeWebSearch(
  query: string,
  maxResults: number = 8,
): Promise<WebSearchResult> {
  const TIMEOUT = 15_000;

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AutoAgent/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        results: [],
        content: `Search failed: HTTP ${response.status}`,
        success: false,
      };
    }

    const html = await response.text();
    const results = extractResults(html).slice(0, maxResults);

    if (results.length === 0) {
      return {
        results: [],
        content: `No results found for: "${query}"`,
        success: true,
      };
    }

    const formatted = results.map((r, i) =>
      `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet || "(no snippet)"}`
    ).join("\n\n");

    return {
      results,
      content: `Found ${results.length} results for "${query}":\n\n${formatted}`,
      success: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      return { results: [], content: `Search timed out after ${TIMEOUT / 1000}s`, success: false };
    }
    return { results: [], content: `Search error: ${msg}`, success: false };
  }
}
