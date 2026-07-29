import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupplierDashboard } from "./supplier-dashboard";

const testState = vi.hoisted(() => ({
  verificationStatus: "unverified" as "unverified" | "verified",
  queryCalls: [] as Array<{ reference: string; args: unknown }>,
}));

vi.mock("@repo/backend/client", () => ({
  api: {
    organizations: { currentContext: "currentContext" },
    supplierOrders: { getSummary: "supplierSummary" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string, args: unknown) => {
    testState.queryCalls.push({ reference, args });
    if (reference === "currentContext") {
      return {
        kind: "ready",
        allowedViews: ["supplier"],
        organization: { verificationStatus: testState.verificationStatus },
      };
    }
    return {
      counts: {
        requiresDecision: 0n,
        expired: 0n,
        accepted: 0n,
        rejected: 0n,
      },
      blockers: [],
      recentIncoming: [],
    };
  },
}));

describe("SupplierDashboard authorization-aware query gating", () => {
  beforeEach(() => {
    testState.verificationStatus = "unverified";
    testState.queryCalls = [];
  });

  it("does not request the protected summary for an unverified supplier", () => {
    render(<SupplierDashboard />);

    expect(testState.queryCalls).toContainEqual({
      reference: "supplierSummary",
      args: "skip",
    });
    expect(screen.getByRole("heading", { name: "Supplier access unavailable" })).toBeVisible();
  });

  it("loads the summary for a verified supplier", () => {
    testState.verificationStatus = "verified";

    render(<SupplierDashboard />);

    expect(testState.queryCalls).toContainEqual({
      reference: "supplierSummary",
      args: {},
    });
    expect(screen.getByRole("heading", { name: "Supplier workspace" })).toBeVisible();
  });
});
