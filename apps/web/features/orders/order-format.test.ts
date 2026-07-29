import { describe, expect, it } from "vitest";

import { orderStatusLabel } from "./order-format";

describe("Sprint 6 Trade Agreement terminology", () => {
  it("uses Exporter language for an issued Trade Order", () => {
    expect(orderStatusLabel("sent")).toBe("Awaiting Exporter");
  });
});
