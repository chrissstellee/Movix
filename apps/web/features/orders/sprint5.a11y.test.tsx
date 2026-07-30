import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { OrderDetail } from "./order-detail";
import { SupplierDashboard } from "./supplier-dashboard";

const testState = vi.hoisted(() => ({
  verificationStatus: "verified" as "not_started" | "pending" | "verified" | "action_required",
  supplierAcceptanceDeadlineOffsetMs: 60_000,
}));

vi.mock("@repo/backend/client", () => ({
  api: {
    organizations: { currentContext: "currentContext" },
    organizationVerification: { current: "organizationVerification" },
    supplierOrders: { getSummary: "supplierSummary" },
    orderDetails: { get: "orderDetail" },
    orderTimeline: { list: "timeline" },
    shipments: { get: "shipment" },
    tradeDocuments: {
      list: "tradeDocuments",
      createUpload: "createDocumentUpload",
      completeUpload: "completeDocumentUpload",
    },
    orderDecisions: { accept: "accept", reject: "reject" },
    orderRevisions: { startFromCurrent: "startRevision" },
    orders: { cancel: "cancel" },
    escrowFunding: {
      getForOrder: "escrowFundingGetForOrder",
      prepare: "escrowFundingPrepare",
      recordSubmission: "escrowFundingRecordSubmission",
      confirmReceipt: "escrowFundingConfirmReceipt",
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue({}),
  useQuery: (reference: string) => {
    if (reference === "currentContext") {
      return {
        kind: "ready",
        allowedViews: ["supplier"],
        organization: { verificationStatus: "verified" },
      };
    }
    if (reference === "supplierSummary") {
      return {
        counts: {
          requiresDecision: 1n,
          expired: 2n,
          accepted: 3n,
          rejected: 4n,
        },
        blockers: [],
        recentIncoming: [
          {
            orderId: "order-1",
            purchaseOrderNumber: "PO-S5-001",
            buyerName: "Buyer Incorporated",
            title: "Long supplier-visible title",
            revisionNumber: 2n,
            grandTotalBaseUnits: 117_000_000n,
            assetCode: "USDC",
            agreementStatus: "sent",
            supplierQueueState: "requires_decision",
            supplierAcceptanceDeadline: Date.now() + 60_000,
            sortTimestamp: Date.now(),
          },
        ],
      };
    }
    if (reference === "organizationVerification") {
      return { status: testState.verificationStatus };
    }
    if (reference === "shipment") return null;
    if (reference === "tradeDocuments") return [];
    return {
      viewerSide: "supplier",
      order: {
        id: "order-1",
        agreementStatus: "sent",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        supplierQueueState: "requires_decision",
        version: 4n,
        fundingEligible: false,
      },
      revision: {
        id: "revision-2",
        version: 7n,
        revisionNumber: 2n,
        supplierOrganizationId: "supplier-1",
        buyerLegalName: "Buyer Incorporated",
        supplierLegalName: "Supplier Incorporated",
        buyerContact: { name: "Buyer Contact", email: "buyer@example.com" },
        supplierContact: { name: "Supplier Contact", email: "supplier@example.com" },
        billingAddress: { line1: "1 Buyer Street", city: "Makati" },
        shippingAddress: { line1: "2 Supplier Street", city: "Taguig" },
        purchaseOrderNumber: "PO-S5-001",
        title: "Machine parts",
        timezone: "Asia/Manila",
        orderDate: "2026-07-28",
        issueDate: "2026-07-28",
        requestedDeliveryDate: "2026-08-31",
        supplierAcceptanceDeadline: Date.now() + testState.supplierAcceptanceDeadlineOffsetMs,
        fundingDeadline: Date.now() + 120_000,
        asset: {
          key: "testnet:USDC",
          code: "USDC",
          issuer: null,
          contractId: "C".repeat(56),
          decimals: 7n,
          network: "testnet",
        },
        deliveryMethod: "Courier",
        shippingResponsibility: "Buyer",
        freightChargeTreatment: "Added to order",
        inspectionPeriodHours: 24n,
        refundPolicy: "Refund before acceptance.",
        acceptanceCriteria: "Match the approved specification.",
        sharedNotes: "Handle with care.",
        totals: {
          subtotalBaseUnits: 100_000_000n,
          discountTotalBaseUnits: 0n,
          taxTotalBaseUnits: 12_000_000n,
          shippingTotalBaseUnits: 5_000_000n,
          grandTotalBaseUnits: 117_000_000n,
        },
        frozenAt: Date.now(),
        termsHash: "a".repeat(64),
      },
      lines: [
        {
          id: "line-1",
          lineNumber: 1n,
          name: "Machine bolt",
          description: "Stainless steel",
          category: "Hardware",
          manufacturer: "Movix Parts",
          quantityCoefficient: 2n,
          quantityScale: 0n,
          unitOfMeasure: "each",
          unitPriceBaseUnits: 50_000_000n,
          discountKind: "none",
          taxBps: 1_200n,
          requiresInspection: true,
          grossBaseUnits: 100_000_000n,
          discountBaseUnits: 0n,
          taxBaseUnits: 12_000_000n,
          lineTotalBaseUnits: 112_000_000n,
        },
      ],
      canDecide: true,
      offChainNotice: "Acceptance records an off-chain agreement decision and moves no funds.",
    };
  },
  usePaginatedQuery: () => ({
    results: [
      {
        revisionId: "revision-2",
        revisionNumber: 2n,
        events: [
          {
            id: "started:revision-2",
            type: "revision_started",
            timestamp: Date.now(),
          },
        ],
      },
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));

describe("Sprint 5 supplier acceptance surfaces", () => {
  beforeEach(() => {
    testState.verificationStatus = "verified";
    testState.supplierAcceptanceDeadlineOffsetMs = 60_000;
  });

  it("renders an accessible supplier dashboard with exact queue counts", async () => {
    const { container } = render(<SupplierDashboard />);

    expect(screen.getByRole("heading", { name: "Exporter workspace" })).toBeVisible();
    expect(screen.getByText("Requires decision")).toBeVisible();
    expect(screen.getByText("PO-S5-001")).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("renders the supplier-safe review and an accessible acceptance dialog", async () => {
    const { container } = render(<OrderDetail orderId="order-1" />);

    expect(screen.getByText("No — agreement decisions are off-chain")).toBeVisible();
    expect(screen.getByText("a".repeat(64))).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Accept revision" }));
    expect(screen.getByRole("alertdialog", { name: "Accept revision 2?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept revision 2" })).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("blocks document uploads until organization verification is complete", () => {
    testState.verificationStatus = "not_started";

    render(<OrderDetail orderId="order-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Complete organization verification before uploading trade documents.",
    );
    expect(screen.getByRole("link", { name: "Complete verification" })).toHaveAttribute(
      "href",
      "/settings/business#verification",
    );
    expect(screen.getByRole("button", { name: "Upload version" })).toBeDisabled();
  });

  it("removes decision controls and explains recovery after the acceptance deadline", () => {
    testState.supplierAcceptanceDeadlineOffsetMs = -60_000;

    render(<OrderDetail orderId="order-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Decision deadline passed");
    expect(screen.queryByRole("button", { name: "Accept revision" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject revision" })).not.toBeInTheDocument();
  });
});
