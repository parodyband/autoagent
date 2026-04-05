/**
 * Tests for orchestrator abort / cancellation support.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../orchestrator.js";

vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

function makeOrchestrator(): Orchestrator {
  return new Orchestrator({ workDir: "/tmp", autoCommit: false });
}

describe("Orchestrator.abort()", () => {
  let orch: Orchestrator;

  beforeEach(() => {
    orch = makeOrchestrator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("abort() when idle (no active send) is a no-op — no error", () => {
    expect(() => orch.abort()).not.toThrow();
    expect(orch._abortController).toBeNull();
  });

  it("abort() sets the internal controller signal to aborted", () => {
    const controller = new AbortController();
    orch._abortController = controller;

    expect(controller.signal.aborted).toBe(false);
    orch.abort();
    expect(controller.signal.aborted).toBe(true);
    expect(orch._abortController).toBeNull();
  });

  it("calling abort() twice does not throw", () => {
    const controller = new AbortController();
    orch._abortController = controller;
    orch.abort();
    expect(() => orch.abort()).not.toThrow();
  });

  it("abort() clears _abortController after calling", () => {
    orch._abortController = new AbortController();
    orch.abort();
    expect(orch._abortController).toBeNull();
  });
});
