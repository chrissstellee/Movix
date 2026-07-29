import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { BuyerDashboard } from "./buyer-dashboard";
import { OrderCreate } from "./order-create";
import { OrderList } from "./order-list";

const navigationState = vi.hoisted(() => ({ search: "" }));

vi.mock("@repo/backend/client", () => ({
  api: {
    orderDashboard: { getBuyerSummary: "getBuyerSummary" },
    notifications: { listCurrentOrganization: "listNotifications" },
    supplierOrders: { list: "listSupplierOrders" },
    orders: { listBuyerOrders: "listBuyerOrders", send: "send" },
    orderDrafts: {
      create: "create",
      get: "getDraft",
      getReview: "getReview",
      saveSupplier: "saveSupplier",
      saveHeader: "saveHeader",
      upsertLine: "upsertLine",
      removeLine: "removeLine",
      saveTerms: "saveTerms",
    },
    organizations: {
      currentContext: "currentContext",
      getBusinessSettings: "getBusinessSettings",
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (reference: string) => {
    if (reference === "currentContext") {
      return {
        kind: "ready",
        organization: { id: "organization-1" },
        allowedViews: ["buyer"],
      };
    }
    if (reference === "getBusinessSettings") {
      return {
        primaryContact: { id: "contact-1", name: "Buyer Contact", email: "buyer@example.com" },
        addresses: [
          { id: "billing-1", type: "billing", label: "Billing", city: "Makati" },
          { id: "shipping-1", type: "shipping", label: "Warehouse", city: "Makati" },
        ],
      };
    }
    if (reference === "getDraft") {
      return {
        order: {
          id: "order-1",
          agreementStatus: "draft",
          fulfillmentStatus: "not_started",
          settlementStatus: "unfunded",
          version: 1n,
        },
        revision: {
          id: "revision-1",
          version: 1n,
          totals: {
            subtotalBaseUnits: 0n,
            discountTotalBaseUnits: 0n,
            taxTotalBaseUnits: 0n,
            shippingTotalBaseUnits: 0n,
            grandTotalBaseUnits: 0n,
          },
        },
        lines: [],
      };
    }
    if (reference === "getReview") {
      return {
        complete: true,
        blockers: [],
        order: { id: "order-1", agreementStatus: "draft" },
        revision: {
          id: "revision-1",
          version: 1n,
          buyerLegalName: "Buyer Incorporated",
          supplierLegalName: "Supplier Incorporated",
          purchaseOrderNumber: "PO-001",
          title: "Machine parts",
          description: "Two-line fixture",
          timezone: "Asia/Manila",
          orderDate: "2026-07-28",
          issueDate: "2026-07-28",
          requestedDeliveryDate: "2026-08-31",
          supplierAcceptanceDeadline: Date.parse("2026-07-29T09:00:00+08:00"),
          fundingDeadline: Date.parse("2026-07-30T09:00:00+08:00"),
          asset: { code: "USDC", decimals: 7n, network: "testnet" },
          buyerContact: { name: "Buyer Contact", email: "buyer@example.com" },
          supplierContact: { name: "Supplier Contact", email: "supplier@example.com" },
          billingAddress: {
            label: "Billing",
            line1: "1 Buyer Street",
            city: "Makati",
            countryCode: "PH",
          },
          shippingAddress: {
            label: "Warehouse",
            line1: "2 Delivery Street",
            city: "Taguig",
            countryCode: "PH",
          },
          deliveryMethod: "Courier",
          shippingResponsibility: "Buyer",
          freightChargeTreatment: "Added to order",
          inspectionPeriodHours: 24n,
          refundPolicy: "Refund before acceptance",
          acceptanceCriteria: "Match the approved specification.",
          totals: {
            subtotalBaseUnits: 100_000_000n,
            discountTotalBaseUnits: 0n,
            taxTotalBaseUnits: 12_000_000n,
            shippingTotalBaseUnits: 5_000_000n,
            grandTotalBaseUnits: 117_000_000n,
          },
        },
        lines: [
          {
            id: "line-1",
            lineNumber: 1n,
            name: "Machine bolt",
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
        totals: {
          subtotalBaseUnits: 100_000_000n,
          discountTotalBaseUnits: 0n,
          taxTotalBaseUnits: 12_000_000n,
          shippingTotalBaseUnits: 5_000_000n,
          grandTotalBaseUnits: 117_000_000n,
        },
        termsHash: "a".repeat(64),
      };
    }
    return {
      counts: { draft: 1n, sent: 2n },
      recent: [
        {
          orderId: "order-1",
          purchaseOrderNumber: "PO-001",
          supplierName: "Fixture Supplier",
          title: "Machine parts",
          issueDate: "2026-07-28",
          grandTotalBaseUnits: 125_000_000n,
          assetCode: "USDC",
          agreementStatus: "sent",
          fulfillmentStatus: "not_started",
          settlementStatus: "unfunded",
          sortTimestamp: 1,
        },
      ],
      canCreate: true,
      blockers: [],
    };
  },
  usePaginatedQuery: () => ({
    results: [
      {
        orderId: "order-1",
        purchaseOrderNumber: "PO-001",
        supplierName: "Fixture Supplier",
        title: "Machine parts",
        issueDate: "2026-07-28",
        grandTotalBaseUnits: 125_000_000n,
        assetCode: "USDC",
        agreementStatus: "sent",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        sortTimestamp: 1,
      },
    ],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));

describe("Sprint 4 buyer surfaces", () => {
  it("renders an accessible buyer dashboard with exact attention labels", async () => {
    const { container } = render(<BuyerDashboard />);

    expect(screen.getByRole("heading", { name: "Buyer workspace" })).toBeVisible();
    expect(screen.getByText("Drafts needing completion")).toBeVisible();
    expect(screen.getAllByText("Awaiting supplier").length).toBeGreaterThan(0);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("renders an accessible responsive order list", async () => {
    const { container } = render(<OrderList />);

    expect(screen.getByRole("heading", { name: "Orders" })).toBeVisible();
    expect(screen.getAllByText("PO-001").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Order status")).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("starts order creation as an accessible guided supplier step", async () => {
    navigationState.search = "orderId=order-1";
    const { container } = render(<OrderCreate />);

    expect(screen.getByText("Step 1 of 5: Supplier")).toBeVisible();
    expect(screen.getByRole("heading", { name: "1. Supplier" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "2. Order details" })).not.toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
    navigationState.search = "";
  });

  it("reviews supplier, order details, items, terms, and totals before sending", async () => {
    navigationState.search = "orderId=order-1";
    const { container } = render(<OrderCreate />);

    fireEvent.click(screen.getByRole("button", { name: /5\. Review/i }));

    expect(screen.getByRole("heading", { name: "Supplier and parties" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Order details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Items" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Terms" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Totals" })).toBeVisible();
    expect(screen.getAllByText("Supplier Incorporated").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Machine bolt/).length).toBeGreaterThan(0);
    expect(screen.getByText("Match the approved specification.")).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
    navigationState.search = "";
  });
});
