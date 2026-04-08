import { describe, it, expect, vi } from "vitest";
import { retryWithBackoff } from "../tool-recovery.js";

describe("retryWithBackoff", () => {
  it("succeeds on first try without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds after a retry when first attempt fails", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new Error("transient");
      return "recovered";
    });
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));
    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })
    ).rejects.toThrow("permanent");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("wraps non-Error rejections in an Error", async () => {
    const fn = vi.fn().mockRejectedValue("string error");
    await expect(
      retryWithBackoff(fn, { maxRetries: 1, baseDelayMs: 1 })
    ).rejects.toThrow("string error");
  });
});
