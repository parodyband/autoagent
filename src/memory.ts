/**
 * Structured memory module — parses memory.md into queryable sections.
 *
 * memory.md uses `## Heading` to delimit sections. This module:
 * - Parses raw markdown into named sections
 * - Reads/writes individual sections programmatically
 * - Provides typed parsing for key sections (Schemas, Backlog)
 *
 * This replaces free-text memory with a structured knowledge store.
 */

// ─── Types ──────────────────────────────────────────────────

export interface MemorySection {
  heading: string;
  content: string;
}

export interface SchemaEntry {
  pattern: string;
  insight: string;
  confidence: number;
}

export interface BacklogItem {
  id: number;
  item: string;
  leverage: string;
  status: string;
}

// ─── Parsing ────────────────────────────────────────────────

/**
 * Parse memory.md into sections delimited by `## ` headings.
 * Content before the first heading goes into a section with heading "".
 */
export function parseMemory(raw: string): MemorySection[] {
  const sections: MemorySection[] = [];
  const lines = raw.split("\n");
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Save previous section
      sections.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
      currentHeading = line.slice(3).trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  // Save last section
  sections.push({ heading: currentHeading, content: currentLines.join("\n").trim() });

  return sections.filter(s => s.heading || s.content); // drop empty preamble
}

/**
 * Get a section by heading (case-insensitive prefix match).
 */
export function getSection(sections: MemorySection[], heading: string): string | null {
  const lower = heading.toLowerCase();
  const found = sections.find(s => s.heading.toLowerCase().startsWith(lower));
  return found ? found.content : null;
}

/**
 * Set a section's content. If the section doesn't exist, append it.
 */
export function setSection(sections: MemorySection[], heading: string, content: string): MemorySection[] {
  const lower = heading.toLowerCase();
  const idx = sections.findIndex(s => s.heading.toLowerCase().startsWith(lower));
  if (idx >= 0) {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], content };
    return updated;
  }
  return [...sections, { heading, content }];
}

/**
 * Serialize sections back to markdown.
 */
export function serializeMemory(sections: MemorySection[]): string {
  return sections.map(s => {
    const header = s.heading ? `## ${s.heading}\n\n` : "";
    return `${header}${s.content}`;
  }).join("\n\n---\n\n");
}

// ─── Typed section parsers ──────────────────────────────────

/**
 * Parse Key Schemas section into typed entries.
 * Expects lines like: - **pattern**: insight (confidence: 0.9)
 */
export function parseSchemas(content: string): SchemaEntry[] {
  const entries: SchemaEntry[] = [];
  const re = /^- \*\*(.+?)\*\*[.:]\s*(.+?)(?:\(confidence:\s*([\d.]+)\))?$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    entries.push({
      pattern: match[1].trim(),
      insight: match[2].trim().replace(/\s*\($/, ""),
      confidence: match[3] ? parseFloat(match[3]) : 0.5,
    });
  }
  return entries;
}

/**
 * Serialize a schema entry to markdown bullet format.
 */
export function serializeSchema(entry: SchemaEntry): string {
  return `- **${entry.pattern}**: ${entry.insight} (confidence: ${entry.confidence})`;
}

/**
 * Parse Backlog table into typed items.
 */
export function parseBacklog(content: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
    if (match) {
      items.push({
        id: parseInt(match[1], 10),
        item: match[2].replace(/\*\*/g, "").trim(),
        leverage: match[3].trim(),
        status: match[4].trim(),
      });
    }
  }
  return items;
}
