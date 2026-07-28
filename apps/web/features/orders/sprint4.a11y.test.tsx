import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { BuyerDashboard } from "./buyer-dashboard";
import { OrderCreate } from "./order-create";
import { OrderList } from "./order-list";

const navigationState = vi.hoisted(() => ({ search: "" }));

vi.mock("@repo/backend/client", () => ({
  api: {
    orderDashboard: { getBuyerSummary: "getBuyerSummary" },
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
      return { kind: "ready", organization: { id: "organization-1" } };
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
        complete: false,
        blockers: [{ field: "supplier", message: "Select a supplier." }],
        order: { id: "order-1", agreementStatus: "draft" },
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
        totals: {
          subtotalBaseUnits: 0n,
          discountTotalBaseUnits: 0n,
          taxTotalBaseUnits: 0n,
          shippingTotalBaseUnits: 0n,
          grandTotalBaseUnits: 0n,
        },
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
});
