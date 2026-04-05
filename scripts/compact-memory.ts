/**
 * Memory compaction script for AutoAgent.
 * 
 * Reads memory.md and if it's over a threshold, compacts older entries
 * while keeping the most recent entries in full.
 * 
 * Run: npx tsx scripts/compact-memory.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const MEMORY_FILE = path.join(ROOT, "memory.md");
const THRESHOLD = 6000;  // chars before compaction kicks in
const KEEP_FULL = 2;     // keep last N entries in full

interface MemorySection {
  header: string;    // e.g. "## Iteration 2 — list_files Tool + Metrics (2026-04-05)"
  body: string;      // full body text
  isEntry: boolean;  // true if it's an iteration/event entry (starts with ## Iteration or ## CIRCUIT or ## FATAL)
}

function parseMemory(content: string): { preamble: string; sections: MemorySection[] } {
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
          isEntry: /^## (Iteration|CIRCUIT|FATAL)/.test(currentHeader),
        });
      }
      currentHeader = line;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Push last section
  if (currentHeader) {
    sections.push({
      header: currentHeader,
      body: currentBody.join("\n").trim(),
      isEntry: /^## (Iteration|CIRCUIT|FATAL)/.test(currentHeader),
    });
  }

  return { preamble, sections };
}

function compactSection(section: MemorySection): string {
  const lines = section.body.split("\n");
  const compacted: string[] = [];
  
  // Extract key insights: lines starting with bullets that contain important keywords
  const importantPatterns = [
    /key insight/i, /architecture/i, /mental model/i, /important/i,
    /\*\*.*\*\*/, /^###/, /built/i, /verified/i, /design decision/i,
  ];
  
  // Keep ### subsections as one-liners
  let inSubsection = false;
  let subsectionName = "";
  let keyPoints: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (inSubsection && keyPoints.length > 0) {
        compacted.push(`- **${subsectionName}**: ${keyPoints.slice(0, 2).join("; ")}`);
      }
      inSubsection = true;
      subsectionName = line.replace(/^### /, "").trim();
      keyPoints = [];
    } else if (inSubsection) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("---")) {
        // Extract numbered/bulleted key points
        const cleaned = trimmed.replace(/^[-*\d.]+\s*/, "").trim();
        if (cleaned.length > 10 && cleaned.length < 200) {
          keyPoints.push(cleaned);
        }
      }
    } else {
      // Top-level content — keep short important lines
      const trimmed = line.trim();
      if (trimmed.startsWith("- **") || trimmed.startsWith("* **")) {
        compacted.push(trimmed);
      }
    }
  }
  
  // Flush last subsection
  if (inSubsection && keyPoints.length > 0) {
    compacted.push(`- **${subsectionName}**: ${keyPoints.slice(0, 2).join("; ")}`);
  }
  
  // If we got nothing useful, just take first 3 non-empty lines
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

  const { preamble, sections } = parseMemory(content);
  const entries = sections.filter(s => s.isEntry);
  const nonEntries = sections.filter(s => !s.isEntry);

  // Keep last KEEP_FULL entries in full, compact the rest
  const toCompact = entries.slice(0, Math.max(0, entries.length - KEEP_FULL));
  const toKeepFull = entries.slice(Math.max(0, entries.length - KEEP_FULL));

  const parts: string[] = [preamble.trim()];
  
  if (toCompact.length > 0) {
    parts.push("\n\n## Compacted History\n");
    for (const section of toCompact) {
      const shortHeader = section.header.replace("## ", "**") + "**";
      const shortBody = compactSection(section);
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
