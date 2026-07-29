import { render, screen } from "@testing-library/react";
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
}));

vi.mock("@repo/backend/client", () => ({
  api: {
    organizations: { currentContext: "currentContext" },
    orders: { listBuyerOrders: "listBuyerOrders" },
    supplierOrders: { list: "listSupplierOrders" },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("view=supplier"),
}));

vi.mock("convex/react", () => ({
  useQuery: () => testState.context,
  usePaginatedQuery: (reference: string, args: unknown) => {
    testState.paginatedCalls.push({ reference, args });
    return {
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    };
  },
}));

describe("OrderList authorization-aware query gating", () => {
  beforeEach(() => {
    testState.context = undefined;
    testState.paginatedCalls = [];
  });

  it("does not query either order projection before organization context resolves", () => {
    render(<OrderList />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading order view");
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

  it("does not query supplier orders for an unverified supplier organization", () => {
    testState.context = {
      kind: "ready",
      allowedViews: ["supplier"],
      organization: { verificationStatus: "unverified" },
    };

    render(<OrderList />);

    expect(testState.paginatedCalls).toEqual([
      { reference: "listBuyerOrders", args: "skip" },
      { reference: "listSupplierOrders", args: "skip" },
    ]);
    expect(screen.getByRole("heading", { name: "Supplier access unavailable" })).toBeVisible();
  });
});
