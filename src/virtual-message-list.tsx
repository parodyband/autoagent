import React from "react";
import { Box, Text } from "ink";
import type { Message } from "./tui.js";

interface VirtualMessageListProps {
  messages: Message[];
  windowSize?: number;
  scrollOffset?: number;
  renderMessage: (msg: Message, index: number) => React.ReactNode;
}

/** Collapse consecutive tool messages: show first + last + count indicator when >3. */
function collapseToolRuns(
  messages: { msg: Message; originalIndex: number }[],
): { msg: Message; originalIndex: number; collapsed?: number }[] {
  const result: { msg: Message; originalIndex: number; collapsed?: number }[] = [];
  let i = 0;
  while (i < messages.length) {
    if (messages[i].msg.role !== "tool") {
      result.push(messages[i]);
      i++;
      continue;
    }
    // Start of a tool run
    let runEnd = i;
    while (runEnd < messages.length && messages[runEnd].msg.role === "tool") {
      runEnd++;
    }
    const runLen = runEnd - i;
    if (runLen <= 3) {
      // Show all
      for (let j = i; j < runEnd; j++) {
        result.push(messages[j]);
      }
    } else {
      // Show first, collapse indicator, last
      result.push(messages[i]);
      result.push({ msg: messages[i].msg, originalIndex: -1, collapsed: runLen - 2 });
      result.push(messages[runEnd - 1]);
    }
    i = runEnd;
  }
  return result;
}

export function VirtualMessageList({
  messages,
  windowSize = 20,
  scrollOffset = 0,
  renderMessage,
}: VirtualMessageListProps) {
  if (messages.length === 0) {
    return <Box flexDirection="column" />;
  }

  // Compute visible window based on scroll offset
  const endIndex = Math.max(0, messages.length - scrollOffset);
  const startIndex = Math.max(0, endIndex - windowSize);
  const visible = messages.slice(startIndex, endIndex);

  // Tag each with original index
  const tagged = visible.map((msg, i) => ({
    msg,
    originalIndex: startIndex + i,
  }));

  // Collapse consecutive tool runs
  const collapsed = collapseToolRuns(tagged);

  const hiddenBefore = startIndex;
  const hiddenAfter = messages.length - endIndex;

  return (
    <Box flexDirection="column">
      {/* Hidden messages indicator (above) */}
      {hiddenBefore > 0 && (
        <Box marginY={0}>
          <Text color="gray" dimColor>
            {`── ${hiddenBefore} earlier messages (↑ to scroll) ──`}
          </Text>
        </Box>
      )}

      {/* Visible messages */}
      {collapsed.map((entry, i) => {
        if (entry.collapsed) {
          return (
            <Box key={`collapsed-${i}`} marginLeft={2}>
              <Text color="gray" dimColor>
                {`  ⋯ ${entry.collapsed} more tool calls`}
              </Text>
            </Box>
          );
        }
        return (
          <React.Fragment key={`${entry.msg.role}-${entry.originalIndex}`}>
            {renderMessage(entry.msg, entry.originalIndex)}
          </React.Fragment>
        );
      })}

      {/* Hidden messages indicator (below, when scrolled up) */}
      {hiddenAfter > 0 && (
        <Box marginY={0}>
          <Text color="gray" dimColor>
            {`── ${hiddenAfter} newer messages (↓ to scroll) ──`}
          </Text>
        </Box>
      )}
    </Box>
  );
}
