import { describe, expect, it } from "vitest";

import {
  MAX_CONVEX_INT64,
  calculateOrderLine,
  calculateOrderTotals,
  canonicalizeOrderTermsV1,
  formatOrderAmount,
  normalizePurchaseOrderNumber,
  type OrderTermsV1Input,
} from "./orders.js";

describe("purchase-order normalization", () => {
  it("preserves a normalized display value and creates a buyer-scoped comparison key", () => {
    expect(normalizePurchaseOrderNumber("  ＭＯＶＩＸ\u00a0 PO-001  ")).toEqual({
      display: "MOVIX PO-001",
      comparison: "movix po-001",
    });
  });

  it("rejects blank, control-character, and overlong values", () => {
    expect(() => normalizePurchaseOrderNumber(" ")).toThrow("ORDER_INVALID");
    expect(() => normalizePurchaseOrderNumber("PO\u0000-1")).toThrow("ORDER_INVALID");
    expect(() => normalizePurchaseOrderNumber("P".repeat(121))).toThrow("ORDER_INVALID");
  });
});

describe("exact order arithmetic", () => {
  it("rounds half up once at each line boundary", () => {
    expect(
      calculateOrderLine({
        quantityCoefficient: 15n,
        quantityScale: 1,
        unitPriceBaseUnits: 1n,
        discount: { kind: "none" },
        taxBps: 0n,
      }),
    ).toEqual({
      grossBaseUnits: 2n,
      discountBaseUnits: 0n,
      taxBaseUnits: 0n,
      lineTotalBaseUnits: 2n,
    });
  });

  it("calculates fixed/rate discounts and tax without floating point", () => {
    const fixed = calculateOrderLine({
      quantityCoefficient: 2n,
      quantityScale: 0,
      unitPriceBaseUnits: 125_000_000n,
      discount: { kind: "fixed", baseUnits: 25_000_000n },
      taxBps: 1_200n,
    });
    const rate = calculateOrderLine({
      quantityCoefficient: 3n,
      quantityScale: 0,
      unitPriceBaseUnits: 72_500_000n,
      discount: { kind: "rate", bps: 500n },
      taxBps: 0n,
    });

    expect(fixed).toEqual({
      grossBaseUnits: 250_000_000n,
      discountBaseUnits: 25_000_000n,
      taxBaseUnits: 27_000_000n,
      lineTotalBaseUnits: 252_000_000n,
    });
    expect(rate).toEqual({
      grossBaseUnits: 217_500_000n,
      discountBaseUnits: 10_875_000n,
      taxBaseUnits: 0n,
      lineTotalBaseUnits: 206_625_000n,
    });
    expect(calculateOrderTotals([fixed, rate], 5_000_000n)).toEqual({
      subtotalBaseUnits: 467_500_000n,
      discountTotalBaseUnits: 35_875_000n,
      taxTotalBaseUnits: 27_000_000n,
      shippingTotalBaseUnits: 5_000_000n,
      grandTotalBaseUnits: 463_625_000n,
    });
  });

  it("covers scale six, formatting, invalid discounts, and int64 overflow", () => {
    expect(
      calculateOrderLine({
        quantityCoefficient: 1n,
        quantityScale: 6,
        unitPriceBaseUnits: 1_000_000n,
        discount: { kind: "none" },
        taxBps: 10_000n,
      }).lineTotalBaseUnits,
    ).toBe(2n);
    expect(formatOrderAmount(12_500_000n, 7, "USDC")).toBe("1.25 USDC");
    expect(() =>
      calculateOrderLine({
        quantityCoefficient: 1n,
        quantityScale: 0,
        unitPriceBaseUnits: 10n,
        discount: { kind: "fixed", baseUnits: 11n },
        taxBps: 0n,
      }),
    ).toThrow("AMOUNT_INVALID");
    expect(() =>
      calculateOrderLine({
        quantityCoefficient: 2n,
        quantityScale: 0,
        unitPriceBaseUnits: MAX_CONVEX_INT64,
        discount: { kind: "none" },
        taxBps: 0n,
      }),
    ).toThrow("AMOUNT_OVERFLOW");
  });
});

describe("order-terms-v1 canonicalization", () => {
  const base: OrderTermsV1Input = {
    revisionNumber: 1n,
    buyer: { organizationId: "buyer-1", legalName: "Buyer Corp" },
    supplier: { organizationId: "supplier-1", legalName: "Supplier Corp" },
    purchaseOrderNumber: "PO-001",
    title: "Machine parts",
    description: null,
    timezone: "Asia/Manila",
    asset: {
      key: "testnet:USDC",
      network: "testnet",
      code: "USDC",
      issuer: "GISSUER",
      contractId: "CCONTRACT",
      decimals: 7n,
    },
    lines: [
      {
        lineNumber: 2n,
        name: "Bolt",
        quantityCoefficient: 5n,
        quantityScale: 0n,
        unitPriceBaseUnits: 20n,
        grossBaseUnits: 100n,
        discountBaseUnits: 0n,
        taxBaseUnits: 0n,
        lineTotalBaseUnits: 100n,
      },
      {
        lineNumber: 1n,
        name: "Nut\r\nM8",
        quantityCoefficient: 2n,
        quantityScale: 0n,
        unitPriceBaseUnits: 50n,
        grossBaseUnits: 100n,
        discountBaseUnits: 0n,
        taxBaseUnits: 0n,
        lineTotalBaseUnits: 100n,
      },
    ],
    totals: {
      subtotalBaseUnits: 200n,
      discountTotalBaseUnits: 0n,
      taxTotalBaseUnits: 0n,
      shippingTotalBaseUnits: 0n,
      grandTotalBaseUnits: 200n,
    },
    terms: {
      paymentMode: "escrow",
      deliveryMethod: "courier",
      shippingResponsibility: "buyer",
      freightChargeTreatment: "included",
      inspectionPeriodHours: 48n,
      supplierAcceptanceDeadline: 1_800_000_000_000n,
      fundingDeadline: 1_800_086_400_000n,
      refundPolicy: "Full refund before acceptance.",
      autoReleasePolicy: "none",
    },
    buyerInternalNotes: "Never visible to the supplier or hash.",
  };

  it("uses fixed ordering, line ordering, normalized text, and base-10 integers", () => {
    const canonical = new TextDecoder().decode(canonicalizeOrderTermsV1(base));

    expect(canonical.startsWith("MOVIX_ORDER_TERMS_V1\u0000")).toBe(true);
    expect(canonical.indexOf('"lineNumber":"1"')).toBeLessThan(
      canonical.indexOf('"lineNumber":"2"'),
    );
    expect(canonical).toContain("Nut\\nM8");
    expect(canonical).toContain('"grandTotalBaseUnits":"200"');
    expect(canonical).not.toContain("Never visible");
  });

  it("is independent of input line ordering and changes with a commercial field", () => {
    const reversed = { ...base, lines: [...base.lines].reverse() };
    const changed = { ...base, title: "Different title" };

    expect(canonicalizeOrderTermsV1(reversed)).toEqual(canonicalizeOrderTermsV1(base));
    expect(canonicalizeOrderTermsV1(changed)).not.toEqual(canonicalizeOrderTermsV1(base));
  });
});
