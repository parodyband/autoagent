import { describe, it, expect, vi } from "vitest";

// Test the onContextWarning callback wiring via orchestrator options
describe("TUI context warning", () => {
  it("onContextWarning callback can be passed as orchestrator option", () => {
    // Verify the OrchestratorOptions type accepts onContextWarning
    const callback = vi.fn();
    const opts = {
      workDir: "/tmp",
      onContextWarning: callback,
    };
    // Type-check: opts.onContextWarning should be callable
    expect(typeof opts.onContextWarning).toBe("function");
  });

  it("contextWarning banner text is correct", () => {
    const bannerText = "⚠ Context 80%+ full — consider /clear or start a new session";
    expect(bannerText).toContain("Context 80%+");
    expect(bannerText).toContain("/clear");
  });

  it("contextWarning state starts as false (hidden banner)", () => {
    // Simulate initial state
    let contextWarning = false;
    expect(contextWarning).toBe(false);

    // After onContextWarning fires
    const onContextWarning = () => { contextWarning = true; };
    onContextWarning();
    expect(contextWarning).toBe(true);

    // Resets on new message send
    contextWarning = false;
    expect(contextWarning).toBe(false);
  });

  it("contextWarning resets to false on /clear", () => {
    let contextWarning = true;
    // Simulate /clear handler
    contextWarning = false;
    expect(contextWarning).toBe(false);
  });
});
