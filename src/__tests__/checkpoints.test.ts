import { describe, it, expect, beforeEach } from "vitest";
import { Orchestrator, MAX_CHECKPOINTS } from "../orchestrator.js";

function makeOrchestrator() {
  return new Orchestrator({ workDir: "/tmp" });
}

describe("conversation checkpoints", () => {
  it("saveCheckpoint adds entry with correct label and id", () => {
    const o = makeOrchestrator();
    o.saveCheckpoint("fix the auth bug in login.ts");
    const cps = o.getCheckpoints();
    expect(cps).toHaveLength(1);
    expect(cps[0].id).toBe(0);
    expect(cps[0].label).toBe("fix the auth bug in login.ts");
    expect(cps[0].timestamp).toBeGreaterThan(0);
  });

  it("label is truncated to 60 chars", () => {
    const o = makeOrchestrator();
    const long = "a".repeat(100);
    o.saveCheckpoint(long);
    expect(o.getCheckpoints()[0].label).toHaveLength(60);
  });

  it("ids increment sequentially", () => {
    const o = makeOrchestrator();
    o.saveCheckpoint("first");
    o.saveCheckpoint("second");
    o.saveCheckpoint("third");
    const cps = o.getCheckpoints();
    expect(cps.map(c => c.id)).toEqual([0, 1, 2]);
  });

  it("max 20 checkpoint cap enforced (drops oldest)", () => {
    const o = makeOrchestrator();
    for (let i = 0; i < MAX_CHECKPOINTS + 5; i++) {
      o.saveCheckpoint(`msg ${i}`);
    }
    const cps = o.getCheckpoints();
    expect(cps).toHaveLength(MAX_CHECKPOINTS);
    // oldest dropped — first label should be msg 5
    expect(cps[0].label).toBe("msg 5");
  });

  it("rewindTo restores messages correctly", () => {
    const o = makeOrchestrator();
    // save checkpoint with empty messages
    o.saveCheckpoint("before anything");
    const id0 = o.getCheckpoints()[0].id;

    // rewind to checkpoint 0 — should restore empty messages
    const result = o.rewindTo(id0);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("before anything");
  });

  it("rewindTo unknown id returns null", () => {
    const o = makeOrchestrator();
    const result = o.rewindTo(9999);
    expect(result).toBeNull();
  });

  it("clearHistory resets checkpoints", () => {
    const o = makeOrchestrator();
    o.saveCheckpoint("one");
    o.saveCheckpoint("two");
    o.clearHistory();
    expect(o.getCheckpoints()).toHaveLength(0);
    // ids restart from 0
    o.saveCheckpoint("fresh");
    expect(o.getCheckpoints()[0].id).toBe(0);
  });

  it("getCheckpoints returns a copy (mutations don't affect internal state)", () => {
    const o = makeOrchestrator();
    o.saveCheckpoint("test");
    const cps = o.getCheckpoints();
    cps.pop();
    expect(o.getCheckpoints()).toHaveLength(1);
  });
});
