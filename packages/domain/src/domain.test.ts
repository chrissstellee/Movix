import { describe, expect, it } from "vitest";

import { draftOrder, invalidFixtures } from "./fixtures.js";
import { isTerminalSettlementState, transitionAgreement } from "./lifecycles.js";
import { roleCan } from "./permissions.js";

describe("agreement lifecycle", () => {
  it("allows every approved agreement transition", () => {
    expect(transitionAgreement("draft", "send")).toEqual({ ok: true, state: "sent" });
    expect(transitionAgreement("sent", "accept")).toEqual({
      ok: true,
      state: "accepted",
    });
    expect(transitionAgreement("accepted", "revise")).toEqual({
      ok: true,
      state: "sent",
    });
  });

  it("returns stable reasons for invalid and terminal transitions", () => {
    expect(transitionAgreement("draft", "accept")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(transitionAgreement("cancelled", "save")).toEqual({
      ok: false,
      reason: "terminal_state",
    });
  });
});

describe("permissions and fixtures", () => {
  it("maps financial actions to the approved roles", () => {
    expect(roleCan("finance", "escrow:fund")).toBe(true);
    expect(roleCan("viewer", "escrow:fund")).toBe(false);
    expect(roleCan("operations", "shipment:record")).toBe(true);
  });

  it("keeps amounts and parties deterministic", () => {
    const calculated = draftOrder.lines.reduce(
      (total, line) => total + line.quantity * line.unitPriceBaseUnits,
      0n,
    );
    expect(calculated).toBe(draftOrder.totalBaseUnits);
    expect(invalidFixtures.samePartyOrder.buyerOrganizationKey).toBe(
      invalidFixtures.samePartyOrder.supplierOrganizationKey,
    );
  });

  it("recognizes all terminal settlement states", () => {
    expect(isTerminalSettlementState("released")).toBe(true);
    expect(isTerminalSettlementState("refunded")).toBe(true);
    expect(isTerminalSettlementState("cancelled")).toBe(true);
    expect(isTerminalSettlementState("funded")).toBe(false);
  });
});
