import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  extractFileReferences,
  stripFileReferences,
  loadFileReferences,
} from "../context-loader.js";

const workDir = join(tmpdir(), "file-refs-test-" + Date.now());
mkdirSync(workDir, { recursive: true });
writeFileSync(join(workDir, "foo.ts"), "export const x = 1;\n");
writeFileSync(join(workDir, "bar.ts"), "export const y = 2;\n");

describe("extractFileReferences", () => {
  it("extracts existing files", () => {
    const refs = extractFileReferences("look at #foo.ts please", workDir);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toContain("foo.ts");
  });

  it("ignores non-existent files", () => {
    const refs = extractFileReferences("look at #nonexistent.ts", workDir);
    expect(refs).toHaveLength(0);
  });

  it("extracts multiple refs", () => {
    const refs = extractFileReferences("compare #foo.ts and #bar.ts", workDir);
    expect(refs).toHaveLength(2);
  });

  it("deduplicates refs", () => {
    const refs = extractFileReferences("#foo.ts and #foo.ts again", workDir);
    expect(refs).toHaveLength(1);
  });

  it("handles no refs gracefully", () => {
    const refs = extractFileReferences("just a normal message", workDir);
    expect(refs).toHaveLength(0);
  });
});

describe("stripFileReferences", () => {
  it("strips # prefix from file refs", () => {
    expect(stripFileReferences("look at #src/foo.ts please")).toBe(
      "look at src/foo.ts please"
    );
  });

  it("leaves normal text unchanged", () => {
    expect(stripFileReferences("hello world")).toBe("hello world");
  });
});

describe("loadFileReferences", () => {
  it("loads file contents", () => {
    const absPath = join(workDir, "foo.ts");
    const result = loadFileReferences([absPath], workDir);
    expect(result).toContain("[Referenced files]");
    expect(result).toContain("foo.ts");
    expect(result).toContain("export const x = 1;");
  });

  it("returns empty string for empty array", () => {
    expect(loadFileReferences([], workDir)).toBe("");
  });

  it("respects budget cap", () => {
    // Create a large file
    const bigPath = join(workDir, "big.ts");
    writeFileSync(bigPath, "x".repeat(40_000));
    const result = loadFileReferences([bigPath], workDir);
    expect(result.length).toBeLessThan(35_000);
    rmSync(bigPath);
  });
});
