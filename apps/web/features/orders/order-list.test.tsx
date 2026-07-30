import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderList } from "./order-list";

const testState = vi.hoisted(() => ({
  context: undefined as
    | undefined
    | {
        kind: "ready";
        allowedViews: Array<"buyer" | "supplier">;
        organization: { verificationStatus: "verified" | "unverified" };
      },
  paginatedCalls: [] as Array<{ reference: string; args: unknown }>,
  paginatedStatus: "LoadingFirstPage" as "LoadingFirstPage" | "Exhausted",
  buyerOrders: [] as Array<{
    orderId: string;
    purchaseOrderNumber: string;
    supplierName: string;
    title: string;
    issueDate: string;
    grandTotalBaseUnits: bigint;
    assetCode: string;
    agreementStatus: "draft";
  }>,
  developmentOptions: { available: false } as {
    available: boolean;
    blocker?: string;
  },
  seedAction: vi.fn(),
}));

vi.mock("@repo/backend/client", () => ({
  api: {
    organizations: { currentContext: "currentContext" },
    orders: { listBuyerOrders: "listBuyerOrders" },
    supplierOrders: { list: "listSupplierOrders" },
    developmentFixtures: {
      options: "developmentFixtureOptions",
      seedTradeOrders: "seedTradeOrders",
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("view=supplier"),
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference === "developmentFixtureOptions" ? testState.developmentOptions : testState.context,
  useAction: () => testState.seedAction,
  usePaginatedQuery: (reference: string, args: unknown) => {
    testState.paginatedCalls.push({ reference, args });
    return {
      results: reference === "listBuyerOrders" ? testState.buyerOrders : [],
      status: testState.paginatedStatus,
      loadMore: vi.fn(),
    };
  },
}));

describe("OrderList authorization-aware query gating", () => {
  beforeEach(() => {
    testState.context = undefined;
    testState.paginatedCalls = [];
    testState.paginatedStatus = "LoadingFirstPage";
    testState.buyerOrders = [];
    testState.developmentOptions = { available: false };
    testState.seedAction.mockReset();
  });

  it("does not query either order projection before organization context resolves", () => {
    render(<OrderList />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Trade Order view");
    expect(testState.paginatedCalls).toEqual([
      { reference: "listBuyerOrders", args: "skip" },
      { reference: "listSupplierOrders", args: "skip" },
    ]);
  });

  it("ignores a stale supplier URL for an organization with only buyer access", () => {
    testState.context = {
      kind: "ready",
      allowedViews: ["buyer"],
      organization: { verificationStatus: "verified" },
    };

    render(<OrderList />);

    expect(testState.paginatedCalls[0]).toMatchObject({
      reference: "listBuyerOrders",
      args: {},
    });
    expect(testState.paginatedCalls[1]).toEqual({
      reference: "listSupplierOrders",
      args: "skip",
    });
  });

  it("allows read-only Exporter order access before organization verification", () => {
    testState.context = {
      kind: "ready",
      allowedViews: ["supplier"],
      organization: { verificationStatus: "unverified" },
    };

    render(<OrderList />);

    expect(testState.paginatedCalls).toEqual([
      { reference: "listBuyerOrders", args: "skip" },
      { reference: "listSupplierOrders", args: {} },
    ]);
    expect(screen.getByRole("heading", { name: "Trade Orders" })).toBeVisible();
  });

  it("links editable drafts directly to the existing draft editor", () => {
    testState.context = {
      kind: "ready",
      allowedViews: ["buyer"],
      organization: { verificationStatus: "verified" },
    };
    testState.paginatedStatus = "Exhausted";
    testState.buyerOrders = [
      {
        orderId: "order-1",
        purchaseOrderNumber: "DEMO-ORDER-1",
        supplierName: "ASEAN Exporter",
        title: "Rice import",
        issueDate: "2026-07-30",
        grandTotalBaseUnits: 1_000_000n,
        assetCode: "USDC",
        agreementStatus: "draft",
      },
    ];

    render(<OrderList />);

    for (const link of screen.getAllByRole("link", { name: "Edit draft" })) {
      expect(link).toHaveAttribute("href", "/orders/new?orderId=order-1");
    }
  });

  it("adds development sample data without manual entry", async () => {
    testState.context = {
      kind: "ready",
      allowedViews: ["buyer"],
      organization: { verificationStatus: "verified" },
    };
    testState.developmentOptions = { available: true };
    testState.seedAction.mockResolvedValue({
      orders: [],
      replay: false,
    });

    render(<OrderList />);
    fireEvent.click(screen.getByRole("button", { name: "Add sample data" }));

    await waitFor(() => expect(testState.seedAction).toHaveBeenCalledOnce());
    expect(screen.getByText("Added 3 editable sample Trade Orders.")).toHaveAttribute(
      "role",
      "status",
    );
  });
});
