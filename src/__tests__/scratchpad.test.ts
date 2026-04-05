// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  executeSaveScratchpad,
  executeReadScratchpad,
  clearScratchpad,
} from "../tools/scratchpad.js";

let workDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "scratchpad-test-"));
  clearScratchpad(workDir);
});

describe("scratchpad tools", () => {
  it("executeSaveScratchpad creates file with timestamped content", () => {
    executeSaveScratchpad("first note", workDir);
    const filePath = path.join(workDir, ".autoagent-scratchpad.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const contents = fs.readFileSync(filePath, "utf8");
    expect(contents).toContain("first note");
    // Should contain an ISO timestamp header
    expect(contents).toMatch(/## \d{4}-\d{2}-\d{2}T/);
  });

  it("executeReadScratchpad returns file contents after save", () => {
    executeSaveScratchpad("my note", workDir);
    const result = executeReadScratchpad(workDir);
    expect(result).toContain("my note");
  });

  it("executeReadScratchpad returns (empty) when file doesn't exist", () => {
    // workDir has an empty scratchpad after clearScratchpad; remove it entirely
    const filePath = path.join(workDir, ".autoagent-scratchpad.md");
    fs.unlinkSync(filePath);
    const result = executeReadScratchpad(workDir);
    expect(result).toBe("(empty)");
  });

  it("multiple executeSaveScratchpad calls append not overwrite", () => {
    executeSaveScratchpad("note one", workDir);
    executeSaveScratchpad("note two", workDir);
    const result = executeReadScratchpad(workDir);
    expect(result).toContain("note one");
    expect(result).toContain("note two");
  });
});
