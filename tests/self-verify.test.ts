import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks so they are available before module import
const mockRunDiagnostics = vi.hoisted(() => vi.fn<() => Promise<string | null>>());

vi.mock("../src/diagnostics.js", () => ({
  runDiagnostics: mockRunDiagnostics,
}));

// Import after mock setup
const { selfVerify, resetVerifyTimer } = await import("../src/self-verify.js");

describe("selfVerify", () => {
  beforeEach(() => {
    resetVerifyTimer();
    vi.clearAllMocks();
  });

  it("returns null when diagnostics find no errors", async () => {
    mockRunDiagnostics.mockResolvedValue(null);
    const result = await selfVerify("/some/dir");
    expect(result).toBeNull();
    expect(mockRunDiagnostics).toHaveBeenCalledWith("/some/dir");
  });

  it("returns formatted string when diagnostics find errors", async () => {
    mockRunDiagnostics.mockResolvedValue("src/foo.ts(3,1): error TS2345: ...");
    const result = await selfVerify("/some/dir");
    expect(result).toBe(
      "⚠️ Auto-check found issues:\nsrc/foo.ts(3,1): error TS2345: ..."
    );
  });

  it("debounces: skips re-run if called again within 3 seconds", async () => {
    mockRunDiagnostics.mockResolvedValue(null);

    // First call — should run
    await selfVerify("/some/dir");
    expect(mockRunDiagnostics).toHaveBeenCalledTimes(1);

    // Second call immediately after — should be debounced (return null, not run)
    mockRunDiagnostics.mockResolvedValue("some error");
    const result = await selfVerify("/some/dir");
    expect(result).toBeNull();
    expect(mockRunDiagnostics).toHaveBeenCalledTimes(1); // still only 1 call
  });

  it("runs again after debounce window expires", async () => {
    mockRunDiagnostics.mockResolvedValue(null);

    await selfVerify("/some/dir");
    expect(mockRunDiagnostics).toHaveBeenCalledTimes(1);

    // Simulate time passing beyond debounce window
    resetVerifyTimer();
    mockRunDiagnostics.mockResolvedValue("new error");
    const result = await selfVerify("/some/dir");
    expect(result).toBe("⚠️ Auto-check found issues:\nnew error");
    expect(mockRunDiagnostics).toHaveBeenCalledTimes(2);
  });
});
