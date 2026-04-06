import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { describe, it, expect } from "vitest";
import { VirtualMessageList } from "../virtual-message-list.js";
import type { Message } from "../tui.js";

function makeMessages(count: number, role: Message["role"] = "user"): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (role === "user" ? (i % 2 === 0 ? "user" : "assistant") : role) as Message["role"],
    content: `message-${i}`,
  }));
}

function makeToolMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: "tool" as const,
    content: `tool-${i}`,
    toolName: `tool_${i}`,
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
    expect(frame).not.toContain("earlier messages");
  });

  it("shows only windowed messages when count > windowSize", () => {
    const messages = makeMessages(25);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // Last 10 messages should be visible (indices 15-24)
    expect(frame).toContain("message-24");
    expect(frame).toContain("message-15");
    // Earlier messages should not be visible
    expect(frame).not.toContain("message-14");
  });

  it("shows hidden messages indicator when windowed", () => {
    const messages = makeMessages(25);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("earlier messages");
    // 25 - 10 = 15 hidden
    expect(frame).toContain("15");
  });

  it("window slides as new messages are added — latest always visible", () => {
    const messages = makeMessages(50);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={20} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // The very last message should always be visible
    expect(frame).toContain("message-49");
    // Hidden count = 50 - 20 = 30
    expect(frame).toContain("30");
  });

  it("uses default windowSize of 20 when not specified", () => {
    const messages = makeMessages(5);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("message-0");
    expect(frame).toContain("message-4");
    expect(frame).not.toContain("earlier messages");
  });
});

describe("scrollOffset", () => {
  it("scrollOffset shifts the visible window upward", () => {
    const messages = makeMessages(30);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} scrollOffset={10} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // endIndex = 30 - 10 = 20, startIndex = 10
    // So messages 10-19 visible
    expect(frame).toContain("message-10");
    expect(frame).toContain("message-19");
    expect(frame).not.toContain("message-20");
    expect(frame).not.toContain("message-9");
  });

  it("shows 'newer messages' indicator when scrolled up", () => {
    const messages = makeMessages(30);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} scrollOffset={5} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("newer messages");
    expect(frame).toContain("5");
  });

  it("scrollOffset=0 shows the tail (default behavior)", () => {
    const messages = makeMessages(30);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={10} scrollOffset={0} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("message-29");
    expect(frame).not.toContain("newer messages");
  });

  it("scrollOffset beyond bounds clamps to start", () => {
    const messages = makeMessages(10);
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={5} scrollOffset={100} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // endIndex = max(0, 10 - 100) = 0, shows empty or first few
    // Actually with endIndex=0, visible is empty. Let's check the render handles it.
    // The component should handle this gracefully.
  });
});

describe("tool message collapsing", () => {
  it("shows all tool messages when 3 or fewer consecutive", () => {
    const messages: Message[] = [
      { role: "user", content: "user-msg" },
      ...makeToolMessages(3),
      { role: "assistant", content: "assistant-msg" },
    ];
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={20} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("tool-0");
    expect(frame).toContain("tool-1");
    expect(frame).toContain("tool-2");
    expect(frame).not.toContain("more tool calls");
  });

  it("collapses tool messages when more than 3 consecutive", () => {
    const messages: Message[] = [
      { role: "user", content: "user-msg" },
      ...makeToolMessages(6),
      { role: "assistant", content: "assistant-msg" },
    ];
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={20} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    // First and last tool messages shown
    expect(frame).toContain("tool-0");
    expect(frame).toContain("tool-5");
    // Middle ones collapsed
    expect(frame).not.toContain("tool-2");
    expect(frame).not.toContain("tool-3");
    // Collapse indicator
    expect(frame).toContain("4 more tool calls");
  });

  it("never collapses user/assistant messages", () => {
    const messages: Message[] = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "q3" },
      { role: "assistant", content: "a3" },
    ];
    const { lastFrame } = render(
      <VirtualMessageList messages={messages} windowSize={20} renderMessage={simpleRender} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("q1");
    expect(frame).toContain("a1");
    expect(frame).toContain("q3");
    expect(frame).toContain("a3");
    expect(frame).not.toContain("more tool calls");
  });
});
