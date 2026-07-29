import { describe, expect, it } from "vitest";

import { draftOrder, invalidFixtures } from "./fixtures.js";
import {
  isFundingEligible,
  isTerminalSettlementState,
  normalizeRejectionNote,
  rejectionReasonCodes,
  supplierQueueStates,
  transitionAgreement,
} from "./lifecycles.js";
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
      state: "draft",
    });
    expect(transitionAgreement("rejected", "revise")).toEqual({
      ok: true,
      state: "draft",
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
    expect(transitionAgreement("sent", "revise")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });
});

describe("supplier decision contracts", () => {
  it("exposes the fixed queue and rejection taxonomies", () => {
    expect(supplierQueueStates).toEqual([
      "not_queued",
      "requires_decision",
      "expired",
      "accepted",
      "rejected",
    ]);
    expect(rejectionReasonCodes).toHaveLength(6);
    expect(rejectionReasonCodes).toContain("pricing_or_totals");
  });

  it("normalizes bounded rejection notes", () => {
    expect(normalizeRejectionNote("  Cannot   meet delivery  ")).toBe("Cannot meet delivery");
    expect(normalizeRejectionNote("   ")).toBeUndefined();
    expect(() => normalizeRejectionNote("x".repeat(501))).toThrow("ORDER_DECISION_REASON_INVALID");
  });

  it("derives funding eligibility from the exact accepted revision", () => {
    const accepted = {
      agreementStatus: "accepted" as const,
      settlementStatus: "unfunded" as const,
      currentRevisionId: "revision-2",
      acceptedRevisionId: "revision-2",
      decision: "accepted" as const,
      decisionRevisionId: "revision-2",
      decisionTermsHash: "a".repeat(64),
      currentTermsHash: "a".repeat(64),
    };
    expect(isFundingEligible(accepted)).toBe(true);
    expect(isFundingEligible({ ...accepted, acceptedRevisionId: "revision-1" })).toBe(false);
    expect(isFundingEligible({ ...accepted, settlementStatus: "funded" })).toBe(false);
    expect(isFundingEligible({ ...accepted, decision: "rejected" })).toBe(false);
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
