import { describe, it, expect } from "vitest";
import { scoreToolOutput } from "../compaction-scorer.js";

describe("scoreToolOutput", () => {
  // High importance: error content
  it("returns high importance for output containing 'Error'", () => {
    const result = scoreToolOutput("bash", "Error: Cannot find module 'foo'");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  it("returns high importance for output containing 'FAIL'", () => {
    const result = scoreToolOutput("bash", "FAIL src/__tests__/foo.test.ts");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  it("returns high importance for output containing 'TypeError'", () => {
    const result = scoreToolOutput("bash", "TypeError: undefined is not a function\n  at foo.ts:10:5");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  it("returns high importance for stack trace lines", () => {
    const result = scoreToolOutput("bash", "  at Object.<anonymous> (src/foo.ts:42:10)");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  it("returns high importance for 'Cannot find' messages", () => {
    const result = scoreToolOutput("bash", "Cannot find name 'Foo'");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  // High importance: write_file tool always high
  it("returns high importance for write_file tool regardless of content", () => {
    const result = scoreToolOutput("write_file", "File written successfully.");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  it("returns high importance for patch tool regardless of content", () => {
    const result = scoreToolOutput("patch", "Patched file: -3 +5 lines");
    expect(result.importance).toBe("high");
    expect(result.maxChars).toBe(3000);
  });

  // Medium importance: regular bash/grep/read_file
  it("returns medium importance for regular bash output", () => {
    const result = scoreToolOutput("bash", "src/foo.ts\nsrc/bar.ts\nsrc/baz.ts");
    expect(result.importance).toBe("medium");
    expect(result.maxChars).toBe(1500);
  });

  it("returns medium importance for grep output", () => {
    const result = scoreToolOutput("grep", "src/foo.ts:10: const x = 1;\nsrc/bar.ts:20: const y = 2;");
    expect(result.importance).toBe("medium");
    expect(result.maxChars).toBe(1500);
  });

  it("returns medium importance for read_file output", () => {
    const result = scoreToolOutput("read_file", "import { foo } from './bar.js';\n\nexport function baz() {}");
    expect(result.importance).toBe("medium");
    expect(result.maxChars).toBe(1500);
  });

  // Low importance: empty/whitespace
  it("returns low importance for empty output", () => {
    const result = scoreToolOutput("bash", "");
    expect(result.importance).toBe("low");
    expect(result.maxChars).toBe(500);
  });

  it("returns low importance for whitespace-only output", () => {
    const result = scoreToolOutput("bash", "   \n\n  ");
    expect(result.importance).toBe("low");
    expect(result.maxChars).toBe(500);
  });

  it("returns low importance for npm install success output", () => {
    const result = scoreToolOutput("bash", "added 42 packages in 3.2s");
    expect(result.importance).toBe("low");
    expect(result.maxChars).toBe(500);
  });

  it("returns low importance for git status clean output", () => {
    const result = scoreToolOutput("bash", "nothing to commit, working tree clean");
    expect(result.importance).toBe("low");
    expect(result.maxChars).toBe(500);
  });

  it("returns low importance for very short output", () => {
    const result = scoreToolOutput("bash", "ok");
    expect(result.importance).toBe("low");
    expect(result.maxChars).toBe(500);
  });

  // Unknown tool defaults to medium
  it("returns medium importance for unknown tool with normal content", () => {
    const result = scoreToolOutput("unknown_tool", "some normal output content here");
    expect(result.importance).toBe("medium");
    expect(result.maxChars).toBe(1500);
  });
});
