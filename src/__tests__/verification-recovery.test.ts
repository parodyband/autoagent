import { describe, it, expect, vi } from "vitest";
import { checkVerificationAndContinue, type IterationCtx } from "../conversation.js";

/** Minimal stub — only fields checkVerificationAndContinue reads */
function makeCtx(overrides: {
  verificationFn?: () => Promise<string | null>;
  maxVerificationTurns?: number;
  verificationTurnsUsed?: number;
  once?: boolean;
  failed?: boolean;
}): IterationCtx {
  const logs: string[] = [];
  return {
    verificationFn: overrides.verificationFn,
    maxVerificationTurns: overrides.maxVerificationTurns,
    verificationTurnsUsed: overrides.verificationTurnsUsed,
    once: overrides.once,
    failed: overrides.failed ?? false,
    messages: [],
    log: (msg: string) => logs.push(msg),
  } as unknown as IterationCtx;
}

describe("checkVerificationAndContinue", () => {
  it("returns false when no verificationFn is set", async () => {
    const ctx = makeCtx({});
    const result = await checkVerificationAndContinue(ctx);
    expect(result).toBe(false);
    expect(ctx.messages).toHaveLength(0);
  });

  it("returns false when verification passes (verificationFn returns null)", async () => {
    const ctx = makeCtx({ verificationFn: async () => null });
    const result = await checkVerificationAndContinue(ctx);
    expect(result).toBe(false);
    expect(ctx.messages).toHaveLength(0);
    expect(ctx.verificationTurnsUsed).toBeUndefined();
  });

  it("returns true on first failure and injects message + increments counter", async () => {
    const ctx = makeCtx({ verificationFn: async () => "Tests failed: 2 errors" });
    const result = await checkVerificationAndContinue(ctx);
    expect(result).toBe(true);
    expect(ctx.verificationTurnsUsed).toBe(1);
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0]).toEqual({ role: "user", content: "Tests failed: 2 errors" });
  });

  it("returns false after max recovery turns exhausted", async () => {
    const ctx = makeCtx({
      verificationFn: async () => "Still failing",
      maxVerificationTurns: 3,
      verificationTurnsUsed: 3, // already at max
    });
    const result = await checkVerificationAndContinue(ctx);
    expect(result).toBe(false);
    // No new message injected — just logs a warning
    expect(ctx.messages).toHaveLength(0);
  });

  it("returns false on verificationFn error (non-fatal)", async () => {
    const ctx = makeCtx({
      verificationFn: async () => {
        throw new Error("command not found: tsc");
      },
    });
    const result = await checkVerificationAndContinue(ctx);
    expect(result).toBe(false);
    expect(ctx.messages).toHaveLength(0);
  });

  it("multiple failures increment counter correctly", async () => {
    const ctx = makeCtx({
      verificationFn: async () => "Build error",
      maxVerificationTurns: 5,
    });

    const r1 = await checkVerificationAndContinue(ctx);
    expect(r1).toBe(true);
    expect(ctx.verificationTurnsUsed).toBe(1);

    const r2 = await checkVerificationAndContinue(ctx);
    expect(r2).toBe(true);
    expect(ctx.verificationTurnsUsed).toBe(2);
  });

  it("sets ctx.failed = true in --once mode when recovery turns exhausted", async () => {
    const ctx = makeCtx({
      verificationFn: async () => "Checks failed",
      maxVerificationTurns: 2,
      verificationTurnsUsed: 2, // already exhausted
      once: true,
      failed: false,
    });
    const result = await checkVerificationAndContinue(ctx);
    expect(result).toBe(false);
    expect(ctx.failed).toBe(true);
  });

  it("does NOT set ctx.failed when recovery turns exhausted but once is false", async () => {
    const ctx = makeCtx({
      verificationFn: async () => "Checks failed",
      maxVerificationTurns: 2,
      verificationTurnsUsed: 2,
      once: false,
      failed: false,
    });
    await checkVerificationAndContinue(ctx);
    expect(ctx.failed).toBe(false);
  });
});
