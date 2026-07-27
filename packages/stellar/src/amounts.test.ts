import { describe, expect, it } from "vitest";

import { MAX_CONVEX_AMOUNT, formatBaseAmount, parseDisplayAmount } from "./amounts.js";

describe("exact Stellar amounts", () => {
  it("converts display amounts deterministically", () => {
    expect(parseDisplayAmount("1.2500000", 7)).toBe(12_500_000n);
    expect(formatBaseAmount(12_500_000n, 7)).toBe("1.25");
    expect(formatBaseAmount(10_000_000n, 7)).toBe("1");
  });

  it.each(["", "-1", "1e2", "1,000", ".5", "01"])("rejects invalid input %s", (value) => {
    expect(() => parseDisplayAmount(value, 7)).toThrow();
  });

  it("rejects zero, excess precision, and overflow", () => {
    expect(() => parseDisplayAmount("0", 7)).toThrow("greater than zero");
    expect(() => parseDisplayAmount("1.00000001", 7)).toThrow("at most 7");
    expect(() => parseDisplayAmount((MAX_CONVEX_AMOUNT + 1n).toString(), 0)).toThrow(
      "supported base-unit range",
    );
  });
});
