import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { describe, it, expect } from "vitest";
import { VirtualMessageList } from "../virtual-message-list.js";
import type { Message } from "../tui.js";

function makeMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i === 0 ? "user" : i % 2 === 0 ? "assistant" : "user") as Message["role"],
    content: `message-${i}`,
  }));
}

function simpleRender(msg: Message, index: number) {
  return <Text key={index}>{msg.content}</Text>;
}

describe("VirtualMessageList", () => {
  it("renders all messages when count <= windowSize", () => {
    const messages = makeMessages(5);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    for (const msg of messages) {
      expect(frame).toContain(msg.content);
    }
    expect(frame).not.toContain("earlier messages hidden");
  });

  it("shows only windowed messages when count > windowSize", () => {
    const messages = makeMessages(25);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // Last 9 messages should be visible (windowSize - 1 = 9)
    expect(frame).toContain("message-24");
    expect(frame).toContain("message-16");
    // Middle messages should not be visible
    expect(frame).not.toContain("message-10");
    expect(frame).not.toContain("message-8");
  });

  it("shows hidden messages indicator when windowed", () => {
    const messages = makeMessages(25);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("earlier messages hidden");
    // 25 - 10 = 15 hidden
    expect(frame).toContain("15");
  });

  it("always includes the first user message for context", () => {
    const messages = makeMessages(30);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // First message is always included
    expect(frame).toContain("message-0");
    // Last message also visible
    expect(frame).toContain("message-29");
  });

  it("window slides as new messages are added — latest always visible", () => {
    const messages = makeMessages(50);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={20} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // The very last message should always be visible
    expect(frame).toContain("message-49");
    // First message always included for context
    expect(frame).toContain("message-0");
    // Hidden count = 50 - 20 = 30
    expect(frame).toContain("30");
  });

  it("uses default windowSize of 20 when not specified", () => {
    const messages = makeMessages(5);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // All 5 messages shown, no indicator
    expect(frame).toContain("message-0");
    expect(frame).toContain("message-4");
    expect(frame).not.toContain("earlier messages hidden");
  });
});
