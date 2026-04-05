import { describe, it, expect, vi, afterEach } from "vitest";
import { shouldShowWelcome } from "../welcome.js";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

import * as fs from "fs";

describe("shouldShowWelcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a banner message when .autoagent.md does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = shouldShowWelcome("/fake/project");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("assistant");
    expect(result!.content).toContain("Welcome to AutoAgent");
  });

  it("includes /init instruction in the banner", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = shouldShowWelcome("/fake/project");
    expect(result!.content).toContain("/init");
  });

  it("mentions .autoagent.md in the banner", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = shouldShowWelcome("/fake/project");
    expect(result!.content).toContain(".autoagent.md");
  });

  it("returns null when .autoagent.md exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = shouldShowWelcome("/fake/project");
    expect(result).toBeNull();
  });

  it("checks the correct path based on workDir", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    shouldShowWelcome("/my/project");
    expect(fs.existsSync).toHaveBeenCalledWith("/my/project/.autoagent.md");
  });

  it("returned message role is always 'assistant'", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = shouldShowWelcome("/any/dir");
    expect(result!.role).toBe("assistant");
  });
});
