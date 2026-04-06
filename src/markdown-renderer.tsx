/**
 * Terminal markdown renderer for Ink.
 *
 * Parses markdown text and renders it with terminal formatting:
 * - **bold**, __bold__, *italic*, _italic_, ~~strikethrough~~
 * - `inline code`
 * - ```code blocks``` with dimmed styling
 * - # Headers in bold with color
 * - - Bullet lists
 * - > Blockquotes
 * - Links [text](url)
 * - | Tables |
 */

import React from "react";
import { Box, Text } from "ink";

interface MarkdownProps {
  children: string;
}

type Alignment = "left" | "center" | "right";

interface Line {
  type: "text" | "code" | "header" | "bullet" | "quote" | "hr" | "table";
  content: string;
  level?: number; // header level
  tableRows?: string[][]; // parsed cell contents
  tableAlignments?: Alignment[]; // column alignments
}

function parseLines(markdown: string): Line[] {
  const lines: Line[] = [];
  const rawLines = markdown.split("\n");
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        lines.push({ type: "code", content: codeBuffer.join("\n") });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      i++;
      continue;
    }

    // Table detection: line starts with | and contains at least one more |
    if (/^\|.*\|/.test(line.trim())) {
      const tableResult = parseTable(rawLines, i);
      if (tableResult) {
        lines.push(tableResult.line);
        i = tableResult.endIndex;
        continue;
      }
    }

    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      lines.push({ type: "hr", content: "" });
    } else if (/^#{1,4}\s/.test(line)) {
      const match = line.match(/^(#{1,4})\s+(.+)/);
      if (match) {
        lines.push({ type: "header", content: match[2], level: match[1].length });
      }
    } else if (/^\s*[-*]\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, "");
      lines.push({ type: "bullet", content });
    } else if (/^\s*\d+\.\s/.test(line)) {
      const content = line.replace(/^\s*\d+\.\s+/, "");
      lines.push({ type: "bullet", content });
    } else if (line.startsWith(">")) {
      lines.push({ type: "quote", content: line.replace(/^>\s?/, "") });
    } else {
      lines.push({ type: "text", content: line });
    }
    i++;
  }

  // Close unclosed code block
  if (inCodeBlock && codeBuffer.length > 0) {
    lines.push({ type: "code", content: codeBuffer.join("\n") });
  }

  return lines;
}

/** Parse a markdown table starting at rawLines[startIdx]. Returns null if not a valid table. */
function parseTable(rawLines: string[], startIdx: number): { line: Line; endIndex: number } | null {
  const headerLine = rawLines[startIdx].trim();
  if (!headerLine.startsWith("|") || !headerLine.endsWith("|")) return null;

  // Next line must be a separator
  if (startIdx + 1 >= rawLines.length) return null;
  const sepLine = rawLines[startIdx + 1].trim();
  if (!/^\|[\s:|-]+\|$/.test(sepLine)) return null;

  const parseCells = (line: string): string[] =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

  const headerCells = parseCells(headerLine);
  const sepCells = parseCells(sepLine);

  // Parse alignments from separator
  const alignments: Alignment[] = sepCells.map(cell => {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(":");
    const right = trimmed.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });

  const rows: string[][] = [headerCells];

  // Collect data rows
  let i = startIdx + 2;
  while (i < rawLines.length) {
    const row = rawLines[i].trim();
    if (!row.startsWith("|") || !row.endsWith("|")) break;
    rows.push(parseCells(row));
    i++;
  }

  return {
    line: { type: "table", content: "", tableRows: rows, tableAlignments: alignments },
    endIndex: i,
  };
}

/** Render inline markdown: **bold**, __bold__, *italic*, _italic_, ~~strikethrough~~, `code`, [links](url) */
function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Order matters: __ before _, ** before *, longest match first
  const regex = /(__(.+?)__|~~(.+?)~~|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(<Text key={key++}>{text.slice(lastIndex, match.index)}</Text>);
    }

    if (match[2]) {
      // __bold__
      parts.push(<Text key={key++} bold>{match[2]}</Text>);
    } else if (match[3]) {
      // ~~strikethrough~~
      parts.push(<Text key={key++} strikethrough>{match[3]}</Text>);
    } else if (match[4]) {
      // **bold**
      parts.push(<Text key={key++} bold>{match[4]}</Text>);
    } else if (match[5]) {
      // _italic_
      parts.push(<Text key={key++} italic>{match[5]}</Text>);
    } else if (match[6]) {
      // *italic*
      parts.push(<Text key={key++} italic>{match[6]}</Text>);
    } else if (match[7]) {
      // `inline code`
      parts.push(<Text key={key++} color="green">{match[7]}</Text>);
    } else if (match[8] && match[9]) {
      // [link text](url)
      parts.push(<Text key={key++} color="blue" underline>{match[8]}</Text>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(<Text key={key++}>{text.slice(lastIndex)}</Text>);
  }

  if (parts.length === 0) {
    return <Text>{text}</Text>;
  }

  return <Text>{parts}</Text>;
}

/** Render a markdown table with aligned columns. */
function TableDisplay({ rows, alignments }: { rows: string[][]; alignments?: Alignment[] }) {
  if (rows.length === 0) return null;

  // Calculate max column widths
  const colCount = Math.max(...rows.map(r => r.length));
  const colWidths: number[] = Array(colCount).fill(0);
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const cell = row[c] ?? "";
      colWidths[c] = Math.max(colWidths[c], cell.length);
    }
  }

  function padCell(text: string, width: number, align: Alignment): string {
    const pad = width - text.length;
    if (pad <= 0) return text;
    if (align === "right") return " ".repeat(pad) + text;
    if (align === "center") {
      const left = Math.floor(pad / 2);
      return " ".repeat(left) + text + " ".repeat(pad - left);
    }
    return text + " ".repeat(pad);
  }

  function renderRow(row: string[], idx: number, bold: boolean) {
    const cells = Array.from({ length: colCount }, (_, c) => {
      const cell = row[c] ?? "";
      const align = alignments?.[c] ?? "left";
      return padCell(cell, colWidths[c], align);
    });
    const content = " " + cells.join(" │ ") + " ";
    return bold
      ? <Text key={idx} bold>{content}</Text>
      : <Text key={idx}>{content}</Text>;
  }

  const separator = " " + colWidths.map(w => "─".repeat(w)).join("─┼─") + " ";

  return (
    <Box flexDirection="column" marginLeft={1}>
      {renderRow(rows[0], 0, true)}
      <Text color="gray" dimColor>{separator}</Text>
      {rows.slice(1).map((row, i) => renderRow(row, i + 1, false))}
    </Box>
  );
}

export function Markdown({ children }: MarkdownProps) {
  const lines = parseLines(children);

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        switch (line.type) {
          case "header": {
            const colors = ["cyan", "blue", "magenta", "yellow"] as const;
            const color = colors[Math.min((line.level ?? 1) - 1, colors.length - 1)];
            return (
              <Text key={`line-${i}`} bold color={color}>
                {line.content}
              </Text>
            );
          }
          case "code":
            return (
              <Box key={`line-${i}`} marginLeft={2} flexDirection="column">
                <Text color="green" dimColor>{line.content}</Text>
              </Box>
            );
          case "bullet":
            return (
              <Box key={`line-${i}`} marginLeft={1}>
                <Text color="gray">• </Text>
                <InlineMarkdown text={line.content} />
              </Box>
            );
          case "quote":
            return (
              <Box key={`line-${i}`} marginLeft={1}>
                <Text color="gray" dimColor>│ </Text>
                <Text dimColor><InlineMarkdown text={line.content} /></Text>
              </Box>
            );
          case "hr":
            return <Text key={`line-${i}`} color="gray" dimColor>{"─".repeat(40)}</Text>;
          case "table":
            return <TableDisplay key={`line-${i}`} rows={line.tableRows!} alignments={line.tableAlignments} />;
          default:
            if (!line.content.trim()) return <Text key={`line-${i}`}> </Text>;
            return <InlineMarkdown key={`line-${i}`} text={line.content} />;
        }
      })}
    </Box>
  );
}
