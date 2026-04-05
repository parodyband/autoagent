/**
 * Memory compaction script for AutoAgent.
 * 
 * Reads memory.md and if it's over a threshold, compacts older entries
 * in the Session Log section while keeping the Architecture section intact.
 * 
 * Run: npx tsx scripts/compact-memory.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const MEMORY_FILE = path.join(ROOT, "memory.md");
const THRESHOLD = 6000;  // chars before compaction kicks in
const KEEP_FULL = 2;     // keep last N session log entries in full

interface MemorySection {
  header: string;    // e.g. "## Iteration 2 — list_files Tool + Metrics (2026-04-05)"
  body: string;      // full body text
  isEntry: boolean;  // true if it's an iteration/event entry
}

/**
 * Split memory.md into its top-level structure:
 * - preamble: text before any ## section
 * - architecture: the ## Architecture section (never compacted)
 * - sessionPreamble: text between "## Session Log" and first ### or entry
 * - entries: per-iteration entries within the session log
 */
function parseStructuredMemory(content: string): {
  preamble: string;
  architecture: string | null;
  sessionPreamble: string;
  entries: MemorySection[];
  isStructured: boolean;
} {
  // Check if this is the new structured format
  const hasArchitecture = content.includes("## Architecture");
  const hasSessionLog = content.includes("## Session Log");
  
  if (!hasArchitecture || !hasSessionLog) {
    // Fall back to legacy parsing
    const legacy = parseLegacyMemory(content);
    return {
      preamble: legacy.preamble,
      architecture: null,
      sessionPreamble: "",
      entries: legacy.sections.filter(s => s.isEntry),
      isStructured: false,
    };
  }

  const lines = content.split("\n");
  let preamble = "";
  let architecture = "";
  let sessionPreamble = "";
  const entries: MemorySection[] = [];
  
  type Phase = "preamble" | "architecture" | "session-preamble" | "session-entries";
  let phase: Phase = "preamble";
  let currentHeader = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (line === "## Architecture") {
      preamble = currentBody.join("\n");
      phase = "architecture";
      currentBody = [];
      continue;
    }
    
    if (line === "## Session Log") {
      if (phase === "architecture") {
        architecture = currentBody.join("\n").trim();
      }
      phase = "session-preamble";
      currentBody = [];
      continue;
    }

    if (phase === "session-preamble" || phase === "session-entries") {
      // Detect iteration entries: ### headers or bold iteration lines
      const isEntryHeader = line.startsWith("### ") && /iteration|compacted/i.test(line);
      const isBoldEntry = /^\*\*Iteration \d+/.test(line);
      const isH2Entry = line.startsWith("## ") && /^## (Iteration|CIRCUIT|FATAL)/.test(line);

      if (isEntryHeader || isH2Entry) {
        if (phase === "session-preamble") {
          sessionPreamble = currentBody.join("\n").trim();
        } else if (currentHeader) {
          entries.push({
            header: currentHeader,
            body: currentBody.join("\n").trim(),
            isEntry: true,
          });
        }
        phase = "session-entries";
        currentHeader = line;
        currentBody = [];
        continue;
      }
    }

    currentBody.push(line);
  }

  // Flush last section
  if (phase === "session-preamble") {
    sessionPreamble = currentBody.join("\n").trim();
  } else if (currentHeader) {
    entries.push({
      header: currentHeader,
      body: currentBody.join("\n").trim(),
      isEntry: true,
    });
  }

  return { preamble, architecture, sessionPreamble, entries, isStructured: true };
}

/** Legacy parser for unstructured memory.md (backward compatibility) */
function parseLegacyMemory(content: string): { preamble: string; sections: MemorySection[] } {
  const lines = content.split("\n");
  let preamble = "";
  const sections: MemorySection[] = [];
  let currentHeader = "";
  let currentBody: string[] = [];
  let inPreamble = true;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inPreamble) {
        preamble = currentBody.join("\n");
        inPreamble = false;
      } else if (currentHeader) {
        sections.push({
          header: currentHeader,
          body: currentBody.join("\n").trim(),
          isEntry: /^## (Iteration|CIRCUIT|FATAL|Compacted)/.test(currentHeader),
        });
      }
      currentHeader = line;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentHeader) {
    sections.push({
      header: currentHeader,
      body: currentBody.join("\n").trim(),
      isEntry: /^## (Iteration|CIRCUIT|FATAL|Compacted)/.test(currentHeader),
    });
  }

  return { preamble, sections };
}

function compactEntry(section: MemorySection): string {
  const lines = section.body.split("\n");
  const compacted: string[] = [];
  
  let inSubsection = false;
  let subsectionName = "";
  let keyPoints: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith("### ") || line.startsWith("#### ")) {
      if (inSubsection && keyPoints.length > 0) {
        compacted.push(`- **${subsectionName}**: ${keyPoints.slice(0, 2).join("; ")}`);
      }
      inSubsection = true;
      subsectionName = line.replace(/^#{3,4}\s*/, "").trim();
      keyPoints = [];
    } else if (inSubsection) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("---")) {
        const cleaned = trimmed.replace(/^[-*\d.]+\s*/, "").trim();
        if (cleaned.length > 10 && cleaned.length < 200) {
          keyPoints.push(cleaned);
        }
      }
    } else {
      const trimmed = line.trim();
      if (trimmed.startsWith("- **") || trimmed.startsWith("* **")) {
        compacted.push(trimmed);
      }
    }
  }
  
  if (inSubsection && keyPoints.length > 0) {
    compacted.push(`- **${subsectionName}**: ${keyPoints.slice(0, 2).join("; ")}`);
  }
  
  if (compacted.length === 0) {
    const nonEmpty = lines.filter(l => l.trim().length > 0 && !l.startsWith("---"));
    compacted.push(...nonEmpty.slice(0, 3));
  }
  
  return compacted.join("\n");
}

export function compactMemory(content: string, dryRun = false): { compacted: string; saved: number; wasCompacted: boolean } {
  if (content.length <= THRESHOLD) {
    return { compacted: content, saved: 0, wasCompacted: false };
  }

  const parsed = parseStructuredMemory(content);

  if (parsed.isStructured) {
    // Structured format: only compact session log entries
    const entries = parsed.entries;
    const toCompact = entries.slice(0, Math.max(0, entries.length - KEEP_FULL));
    const toKeepFull = entries.slice(Math.max(0, entries.length - KEEP_FULL));

    const parts: string[] = [parsed.preamble.trim()];
    
    // Architecture section — always kept intact
    parts.push("\n\n## Architecture\n\n" + (parsed.architecture || "") + "\n\n---\n\n## Session Log\n");
    if (parsed.sessionPreamble) {
      parts.push(parsed.sessionPreamble + "\n");
    }

    if (toCompact.length > 0) {
      parts.push("\n### Compacted History\n");
      for (const entry of toCompact) {
        // If already a bold-line compact entry, keep as-is
        if (entry.header.startsWith("### Compacted")) {
          parts.push(entry.body + "\n");
        } else {
          const shortHeader = entry.header.replace(/^#{2,3}\s*/, "**") + "**";
          const shortBody = compactEntry(entry);
          parts.push(`${shortHeader}\n${shortBody}\n`);
        }
      }
      parts.push("---\n");
    }

    for (const entry of toKeepFull) {
      if (entry.header.startsWith("### Compacted")) {
        parts.push(`\n${entry.header}\n\n${entry.body}\n\n---\n`);
      } else {
        parts.push(`\n${entry.header}\n\n${entry.body}\n\n---\n`);
      }
    }

    const compacted = parts.join("\n").replace(/\n{4,}/g, "\n\n\n");
    const saved = content.length - compacted.length;
    return { compacted, saved, wasCompacted: true };
  }

  // Legacy format fallback
  const legacy = parseLegacyMemory(content);
  const entries = legacy.sections.filter(s => s.isEntry);
  const nonEntries = legacy.sections.filter(s => !s.isEntry);

  const toCompact = entries.slice(0, Math.max(0, entries.length - KEEP_FULL));
  const toKeepFull = entries.slice(Math.max(0, entries.length - KEEP_FULL));

  const parts: string[] = [legacy.preamble.trim()];
  
  if (toCompact.length > 0) {
    parts.push("\n\n## Compacted History\n");
    for (const section of toCompact) {
      const shortHeader = section.header.replace("## ", "**") + "**";
      const shortBody = compactEntry(section);
      parts.push(`${shortHeader}\n${shortBody}\n`);
    }
    parts.push("---\n");
  }

  for (const section of nonEntries) {
    parts.push(`\n${section.header}\n${section.body}\n\n---\n`);
  }

  for (const section of toKeepFull) {
    parts.push(`\n${section.header}\n\n${section.body}\n\n---\n`);
  }

  const compacted = parts.join("\n").replace(/\n{4,}/g, "\n\n\n");
  const saved = content.length - compacted.length;
  return { compacted, saved, wasCompacted: true };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("compact-memory.ts")) {
  const dryRun = process.argv.includes("--dry-run");
  
  try {
    const content = readFileSync(MEMORY_FILE, "utf-8");
    console.log(`Memory size: ${content.length} chars (threshold: ${THRESHOLD})`);
    
    const { compacted, saved, wasCompacted } = compactMemory(content, dryRun);
    
    if (!wasCompacted) {
      console.log("No compaction needed.");
      process.exit(0);
    }
    
    console.log(`Compacted: saved ${saved} chars (${content.length} → ${compacted.length})`);
    
    if (dryRun) {
      console.log("\n--- DRY RUN OUTPUT ---\n");
      console.log(compacted);
    } else {
      writeFileSync(MEMORY_FILE, compacted, "utf-8");
      console.log("Written to memory.md");
    }
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
