import { describe, expect, it } from "vitest";

import { parseOrderMoney, parseTaxPercent } from "./order-input";

describe("buyer-friendly order inputs", () => {
  it("converts a seven-decimal asset amount to exact base units", () => {
    expect(parseOrderMoney("12.3456789")).toBe(123_456_789n);
    expect(() => parseOrderMoney("12.34567891")).toThrow(
      "Amount supports at most 7 decimal places",
    );
  });

  it("converts a percentage to exact basis points", () => {
    expect(parseTaxPercent("5")).toBe(500n);
    expect(parseTaxPercent("12.25")).toBe(1_225n);
    expect(() => parseTaxPercent("12.345")).toThrow("at most 2 decimal places");
  });
});
