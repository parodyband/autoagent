import React from "react";
import { Box, Text } from "ink";
import type { Message } from "./tui.js";

interface VirtualMessageListProps {
  messages: Message[];
  windowSize?: number;
  renderMessage: (msg: Message, index: number) => React.ReactNode;
}

export function VirtualMessageList({
  messages,
  windowSize = 20,
  renderMessage,
}: VirtualMessageListProps) {
  if (messages.length <= windowSize) {
    return (
      <Box flexDirection="column">
        {messages.map((msg, i) => (
          <React.Fragment key={`${msg.role}-${i}`}>
            {renderMessage(msg, i)}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  // Include first user message for context + last (windowSize - 1) messages
  const firstMsg = messages[0];
  const tail = messages.slice(-(windowSize - 1));
  const hiddenCount = messages.length - windowSize; // messages.length - 1 (first) - (windowSize-1) (tail)

  return (
    <Box flexDirection="column">
      {/* First message for context */}
      <React.Fragment key={`first-0`}>
        {renderMessage(firstMsg, 0)}
      </React.Fragment>

      {/* Hidden messages indicator */}
      <Box marginY={0}>
        <Text color="gray" dimColor>
          {`── ${hiddenCount} earlier messages hidden ──`}
        </Text>
      </Box>

      {/* Recent messages window */}
      {tail.map((msg, i) => {
        const originalIndex = messages.length - (windowSize - 1) + i;
        return (
          <React.Fragment key={`${msg.role}-${originalIndex}`}>
            {renderMessage(msg, originalIndex)}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
