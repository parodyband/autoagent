/**
 * Terminal markdown renderer for Ink.
 *
 * Parses markdown text and renders it with terminal formatting:
 * - **bold**, *italic*, `inline code`
 * - ```code blocks``` with dimmed styling
 * - # Headers in bold with color
 * - - Bullet lists
 * - > Blockquotes
 * - Links [text](url)
 */

import React from "react";
import { Box, Text } from "ink";

interface MarkdownProps {
  children: string;
}

interface Line {
  type: "text" | "code" | "header" | "bullet" | "quote" | "hr";
  content: string;
  level?: number; // header level
}

function parseLines(markdown: string): Line[] {
  const lines: Line[] = [];
  const rawLines = markdown.split("\n");
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        lines.push({ type: "code", content: codeBuffer.join("\n") });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
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
  }

  // Close unclosed code block
  if (inCodeBlock && codeBuffer.length > 0) {
    lines.push({ type: "code", content: codeBuffer.join("\n") });
  }

  return lines;
}

/** Render inline markdown: **bold**, *italic*, `code`, [links](url) */
function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Match: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(<Text key={key++}>{text.slice(lastIndex, match.index)}</Text>);
    }

    if (match[2]) {
      // **bold**
      parts.push(<Text key={key++} bold>{match[2]}</Text>);
    } else if (match[3]) {
      // *italic*
      parts.push(<Text key={key++} italic>{match[3]}</Text>);
    } else if (match[4]) {
      // `inline code`
      parts.push(<Text key={key++} color="green">{match[4]}</Text>);
    } else if (match[5] && match[6]) {
      // [link text](url)
      parts.push(<Text key={key++} color="blue" underline>{match[5]}</Text>);
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
                <Text italic dimColor><InlineMarkdown text={line.content} /></Text>
              </Box>
            );
          case "hr":
            return <Text key={`line-${i}`} color="gray" dimColor>{"─".repeat(40)}</Text>;
          default:
            if (!line.content.trim()) return <Text key={`line-${i}`}> </Text>;
            return <InlineMarkdown key={`line-${i}`} text={line.content} />;
        }
      })}
    </Box>
  );
}
