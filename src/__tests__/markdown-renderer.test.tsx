import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Markdown } from "../markdown-renderer.js";

describe("Markdown renderer", () => {
  it("renders **bold** text", () => {
    const { lastFrame } = render(<Markdown>{"**hello**"}</Markdown>);
    expect(lastFrame()).toContain("hello");
  });

  it("renders __bold__ (underscore variant)", () => {
    const { lastFrame } = render(<Markdown>{"__hello__"}</Markdown>);
    expect(lastFrame()).toContain("hello");
  });

  it("renders *italic* text", () => {
    const { lastFrame } = render(<Markdown>{"*hello*"}</Markdown>);
    expect(lastFrame()).toContain("hello");
  });

  it("renders _italic_ (underscore variant)", () => {
    const { lastFrame } = render(<Markdown>{"_hello_"}</Markdown>);
    expect(lastFrame()).toContain("hello");
  });

  it("renders ~~strikethrough~~", () => {
    const { lastFrame } = render(<Markdown>{"~~deleted~~"}</Markdown>);
    expect(lastFrame()).toContain("deleted");
  });

  it("renders `inline code`", () => {
    const { lastFrame } = render(<Markdown>{"`code`"}</Markdown>);
    expect(lastFrame()).toContain("code");
  });

  it("renders headers", () => {
    const { lastFrame } = render(<Markdown>{"# Title"}</Markdown>);
    expect(lastFrame()).toContain("Title");
  });

  it("renders bullet lists", () => {
    const { lastFrame } = render(<Markdown>{"- item one\n- item two"}</Markdown>);
    const frame = lastFrame();
    expect(frame).toContain("item one");
    expect(frame).toContain("item two");
  });

  it("renders blockquotes without breaking inner formatting", () => {
    const { lastFrame } = render(<Markdown>{"> quote with **bold**"}</Markdown>);
    const frame = lastFrame();
    expect(frame).toContain("│");
    expect(frame).toContain("bold");
  });

  it("renders code blocks", () => {
    const { lastFrame } = render(<Markdown>{"```\nconst x = 1;\n```"}</Markdown>);
    expect(lastFrame()).toContain("const x = 1;");
  });

  it("renders horizontal rules", () => {
    const { lastFrame } = render(<Markdown>{"---"}</Markdown>);
    expect(lastFrame()).toContain("─");
  });
});

describe("Table rendering", () => {
  it("renders a simple 2-column table", () => {
    const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
    const { lastFrame } = render(<Markdown>{md}</Markdown>);
    const frame = lastFrame();
    expect(frame).toContain("Name");
    expect(frame).toContain("Age");
    expect(frame).toContain("Alice");
    expect(frame).toContain("Bob");
    expect(frame).toContain("30");
    expect(frame).toContain("25");
  });

  it("renders table separator", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { lastFrame } = render(<Markdown>{md}</Markdown>);
    expect(lastFrame()).toContain("─");
  });

  it("handles single-row table", () => {
    const md = "| Col |\n| --- |\n| Val |";
    const { lastFrame } = render(<Markdown>{md}</Markdown>);
    expect(lastFrame()).toContain("Col");
    expect(lastFrame()).toContain("Val");
  });

  it("does not treat non-table pipe content as table", () => {
    const { lastFrame } = render(<Markdown>{"this | is | not | a table"}</Markdown>);
    expect(lastFrame()).toContain("this | is | not | a table");
  });
});
