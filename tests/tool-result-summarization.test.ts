import { describe, it, expect } from "vitest";
import { Orchestrator } from "../src/orchestrator.js";

// Access private methods via `as any`
function makeSummarizer() {
  const orc = new Orchestrator({ workDir: "/tmp", apiKey: "test-key" }) as any;
  return (toolName: string, text: string): string | null =>
    orc.trySummarizeToolText(toolName, text);
}

describe("trySummarizeToolText", () => {
  const summarize = makeSummarizer();

  it("summarizes read_file results >2000 chars with line count and imports", () => {
    const lines = Array.from({ length: 80 }, (_, i) =>
      i === 0 ? `import { foo } from "./foo"` :
      i === 1 ? `import bar from "bar"` :
      `const x${i} = ${i}; // padding to make it long enough`
    ).join("\n");
    expect(lines.length).toBeGreaterThan(2000);

    const result = summarize("read_file", lines);
    expect(result).not.toBeNull();
    expect(result).toContain("read_file");
    expect(result).toContain("80 lines");
    expect(result).toContain("./foo");
    expect(result).toContain("bar");
  });

  it("returns null for read_file results <2000 chars", () => {
    const shortText = "const x = 1;\nconst y = 2;\n";
    expect(shortText.length).toBeLessThan(2000);
    expect(summarize("read_file", shortText)).toBeNull();
  });

  it("summarizes grep results >1500 chars with match/file counts", () => {
    const lines = Array.from({ length: 60 }, (_, i) =>
      `src/file${i % 5}.ts:${i}:  const match${i} = true;`
    ).join("\n");
    expect(lines.length).toBeGreaterThan(1500);

    const result = summarize("grep", lines);
    expect(result).not.toBeNull();
    expect(result).toContain("grep");
    expect(result).toContain("60 matches");
    expect(result).toContain("5 files");
  });

  it("summarizes bash results >3000 chars with truncation", () => {
    const longOutput = "Building project...\n" + "x".repeat(3500);
    expect(longOutput.length).toBeGreaterThan(3000);

    const result = summarize("bash", longOutput);
    expect(result).not.toBeNull();
    expect(result).toContain("bash");
    expect(result).toContain("truncated");
    expect(result!.length).toBeLessThan(longOutput.length);
  });

  it("returns null for bash results with error indicators", () => {
    const errorOutput = "Error: cannot find module 'foo'\n" + "x".repeat(4000);
    expect(summarize("bash", errorOutput)).toBeNull();
  });

  it("summarizes list_files results >1000 chars with dir/file counts", () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => `dir${i}/`),
      ...Array.from({ length: 40 }, (_, i) => `dir${i % 5}/file${i}.ts  (${100 + i} bytes)`),
    ].join("\n");
    expect(entries.length).toBeGreaterThan(1000);

    const result = summarize("list_files", entries);
    expect(result).not.toBeNull();
    expect(result).toContain("list_files");
    expect(result).toContain("5 directories");
    expect(result).toContain("40 files");
  });

  it("returns null for unknown tool types", () => {
    const text = "x".repeat(5000);
    expect(summarize("unknown_tool", text)).toBeNull();
  });

  it("returns null for read_file with Error in content (even if long)", () => {
    const errorContent = 'Error: something failed\n' + "x".repeat(3000);
    expect(summarize("read_file", errorContent)).toBeNull();
  });

  it("returns null for grep results below threshold", () => {
    const shortGrep = "src/foo.ts:1: match";
    expect(summarize("grep", shortGrep)).toBeNull();
  });
});
