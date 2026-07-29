import { describe, expect, it } from "vitest";

import {
  MAX_CONVEX_INT64,
  calculateOrderLine,
  calculateOrderTotals,
  canonicalizeOrderTermsV1,
  canonicalizeOrderTermsV2,
  formatOrderAmount,
  normalizePurchaseOrderNumber,
  type OrderTermsV1Input,
  type TradeTermsSnapshotV2,
  validateTradeTermsSnapshotV2,
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

describe("order-terms-v2 canonicalization", () => {
  const base: TradeTermsSnapshotV2 = {
    schemaVersion: "order-terms-v2",
    revisionNumber: 2n,
    parties: {
      importer: { organizationId: "importer-1", legalName: "Manila Foods Inc." },
      exporter: {
        organizationId: "exporter-1",
        legalName: "Mekong Rice Co.",
        tradingName: "Mekong Rice",
      },
    },
    accounts: {
      importer: "GIMPORTER",
      exporter: "GEXPORTER",
    },
    asset: {
      network: "testnet",
      code: "USDC",
      issuer: "GISSUER",
      contractId: "CCONTRACT",
      decimals: 7n,
    },
    amountBaseUnits: 125_000_000n,
    dates: {
      orderDate: "2026-07-29",
      issueDate: "2026-08-01",
      requestedDeliveryDate: "2026-08-15",
      supplierAcceptanceDeadline: 1_785_628_800_000n,
      fundingDeadline: 1_785_715_200_000n,
      validUntil: null,
    },
    commodityLines: [
      {
        lineNumber: 2n,
        name: "Jasmine rice",
        varietyOrGrade: "Grade A",
        quantity: "5.25",
        unitOfMeasure: "MT",
        originCountry: "VN",
        unitPriceBaseUnits: 5_000_000n,
        discount: { kind: "fixed", baseUnits: 250_000n, bps: null },
        tax: { bps: 0n, code: null },
        amounts: {
          grossBaseUnits: 26_250_000n,
          discountBaseUnits: 250_000n,
          taxBaseUnits: 0n,
          lineTotalBaseUnits: 26_000_000n,
        },
      },
      {
        lineNumber: 1n,
        name: "Arabica\r\ncoffee",
        category: "Coffee",
        specification: "Screen 18",
        quantity: "10",
        unitOfMeasure: "KG",
        originCountry: "ID",
        unitPriceBaseUnits: 10_000_000n,
        discount: { kind: "rate", baseUnits: null, bps: 1_000n },
        tax: { bps: 1_000n, code: "VAT" },
        amounts: {
          grossBaseUnits: 100_000_000n,
          discountBaseUnits: 10_000_000n,
          taxBaseUnits: 9_000_000n,
          lineTotalBaseUnits: 99_000_000n,
        },
      },
    ],
    totals: {
      subtotalBaseUnits: 126_250_000n,
      discountTotalBaseUnits: 10_250_000n,
      taxTotalBaseUnits: 9_000_000n,
      shippingTotalBaseUnits: 0n,
      grandTotalBaseUnits: 125_000_000n,
    },
    destinationCountry: "PH",
    shipmentWindow: { from: "2026-08-01", to: "2026-08-07" },
    arrivalWindow: { from: "2026-08-08", to: "2026-08-15" },
    incoterm: { edition: "2020", rule: "CIF", namedPlace: "Port of Manila" },
    requiredDocumentTypes: ["phytosanitary-certificate", "bill-of-lading"],
    releaseConditions: ["delivery-confirmed", "documents-approved"],
  };

  it("matches the order-terms-v2 golden canonical bytes", () => {
    const canonical = new TextDecoder().decode(canonicalizeOrderTermsV2(base));

    expect(canonical).toBe(
      [
        "MOVIX_ORDER_TERMS_V2\u0000",
        '{"accounts":{"exporter":"GEXPORTER","importer":"GIMPORTER"},',
        '"amountBaseUnits":"125000000",',
        '"arrivalWindow":{"from":"2026-08-08","to":"2026-08-15"},',
        '"asset":{"code":"USDC","contractId":"CCONTRACT","decimals":"7","issuer":"GISSUER","network":"testnet"},',
        '"commodityLines":[{"amounts":{"discountBaseUnits":"10000000","grossBaseUnits":"100000000","lineTotalBaseUnits":"99000000","taxBaseUnits":"9000000"},"category":"Coffee","discount":{"baseUnits":null,"bps":"1000","kind":"rate"},"lineNumber":"1","name":"Arabica\\ncoffee","originCountry":"ID","quantity":"10","specification":"Screen 18","tax":{"bps":"1000","code":"VAT"},"unitOfMeasure":"KG","unitPriceBaseUnits":"10000000","varietyOrGrade":null},',
        '{"amounts":{"discountBaseUnits":"250000","grossBaseUnits":"26250000","lineTotalBaseUnits":"26000000","taxBaseUnits":"0"},"category":null,"discount":{"baseUnits":"250000","bps":null,"kind":"fixed"},"lineNumber":"2","name":"Jasmine rice","originCountry":"VN","quantity":"5.25","specification":null,"tax":{"bps":"0","code":null},"unitOfMeasure":"MT","unitPriceBaseUnits":"5000000","varietyOrGrade":"Grade A"}],',
        '"dates":{"fundingDeadline":"1785715200000","issueDate":"2026-08-01","orderDate":"2026-07-29","requestedDeliveryDate":"2026-08-15","supplierAcceptanceDeadline":"1785628800000","validUntil":null},',
        '"destinationCountry":"PH",',
        '"incoterm":{"edition":"2020","namedPlace":"Port of Manila","rule":"CIF"},',
        '"parties":{"exporter":{"legalName":"Mekong Rice Co.","organizationId":"exporter-1","tradingName":"Mekong Rice"},',
        '"importer":{"legalName":"Manila Foods Inc.","organizationId":"importer-1","tradingName":null}},',
        '"releaseConditions":["delivery-confirmed","documents-approved"],',
        '"requiredDocumentTypes":["bill-of-lading","phytosanitary-certificate"],',
        '"revisionNumber":"2","schemaVersion":"order-terms-v2",',
        '"shipmentWindow":{"from":"2026-08-01","to":"2026-08-07"},',
        '"totals":{"discountTotalBaseUnits":"10250000","grandTotalBaseUnits":"125000000","shippingTotalBaseUnits":"0","subtotalBaseUnits":"126250000","taxTotalBaseUnits":"9000000"}}',
      ].join(""),
    );
  });

  it("is deterministic across commodity, document, and release-condition ordering", () => {
    const reordered: TradeTermsSnapshotV2 = {
      ...base,
      commodityLines: [...base.commodityLines].reverse(),
      requiredDocumentTypes: [...base.requiredDocumentTypes].reverse(),
      releaseConditions: [...base.releaseConditions].reverse(),
    };

    expect(canonicalizeOrderTermsV2(reordered)).toEqual(canonicalizeOrderTermsV2(base));
  });

  it("changes whenever a material trade field changes", () => {
    const firstLine = base.commodityLines[0]!;
    const secondLine = base.commodityLines[1]!;
    const variants: TradeTermsSnapshotV2[] = [
      { ...base, revisionNumber: 3n },
      {
        ...base,
        parties: {
          ...base.parties,
          exporter: { ...base.parties.exporter, organizationId: "exporter-2" },
        },
      },
      { ...base, accounts: { ...base.accounts, exporter: "GEXPORTER2" } },
      { ...base, asset: { ...base.asset, code: "XLM" } },
      { ...base, amountBaseUnits: base.amountBaseUnits + 1n },
      { ...base, dates: { ...base.dates, orderDate: "2026-07-30" } },
      { ...base, dates: { ...base.dates, issueDate: "2026-08-02" } },
      { ...base, dates: { ...base.dates, requestedDeliveryDate: "2026-08-16" } },
      {
        ...base,
        dates: {
          ...base.dates,
          supplierAcceptanceDeadline: base.dates.supplierAcceptanceDeadline + 1n,
        },
      },
      {
        ...base,
        dates: { ...base.dates, fundingDeadline: base.dates.fundingDeadline + 1n },
      },
      { ...base, dates: { ...base.dates, validUntil: 1_785_801_600_000n } },
      {
        ...base,
        commodityLines: [{ ...firstLine, specification: "Moisture max 14%" }, secondLine],
      },
      {
        ...base,
        commodityLines: [{ ...firstLine, quantity: "5.5" }, secondLine],
      },
      {
        ...base,
        commodityLines: [{ ...firstLine, unitOfMeasure: "KG" }, secondLine],
      },
      {
        ...base,
        commodityLines: [{ ...firstLine, originCountry: "TH" }, secondLine],
      },
      {
        ...base,
        commodityLines: [
          { ...firstLine, unitPriceBaseUnits: firstLine.unitPriceBaseUnits + 1n },
          secondLine,
        ],
      },
      {
        ...base,
        commodityLines: [
          {
            ...firstLine,
            discount: {
              ...firstLine.discount,
              baseUnits: firstLine.discount.baseUnits! + 1n,
            },
          },
          secondLine,
        ],
      },
      {
        ...base,
        commodityLines: [
          { ...firstLine, tax: { ...firstLine.tax, bps: firstLine.tax.bps + 1n } },
          secondLine,
        ],
      },
      {
        ...base,
        commodityLines: [{ ...firstLine, tax: { ...firstLine.tax, code: "GST" } }, secondLine],
      },
      ...(
        ["grossBaseUnits", "discountBaseUnits", "taxBaseUnits", "lineTotalBaseUnits"] as const
      ).map((field) => ({
        ...base,
        commodityLines: [
          {
            ...firstLine,
            amounts: {
              ...firstLine.amounts,
              [field]: firstLine.amounts[field] + 1n,
            },
          },
          secondLine,
        ],
      })),
      ...(
        [
          "subtotalBaseUnits",
          "discountTotalBaseUnits",
          "taxTotalBaseUnits",
          "shippingTotalBaseUnits",
          "grandTotalBaseUnits",
        ] as const
      ).map((field) => ({
        ...base,
        totals: {
          ...base.totals,
          [field]: base.totals[field] + 1n,
        },
      })),
      { ...base, destinationCountry: "SG" },
      { ...base, shipmentWindow: { ...base.shipmentWindow, from: "2026-08-02" } },
      { ...base, arrivalWindow: { ...base.arrivalWindow, to: "2026-08-16" } },
      { ...base, incoterm: { ...base.incoterm!, rule: "FOB" } },
      { ...base, requiredDocumentTypes: [...base.requiredDocumentTypes, "packing-list"] },
      { ...base, releaseConditions: [...base.releaseConditions, "inspection-passed"] },
    ];
    const canonical = canonicalizeOrderTermsV2(base);

    for (const variant of variants) {
      expect(canonicalizeOrderTermsV2(variant)).not.toEqual(canonical);
    }
  });

  it("rejects imprecise quantities, invalid windows, unsupported Incoterms, and duplicates", () => {
    const firstLine = base.commodityLines[0]!;
    expect(() =>
      validateTradeTermsSnapshotV2({
        ...base,
        commodityLines: [{ ...firstLine, quantity: "5.250" }],
      }),
    ).toThrow("ORDER_INVALID");
    expect(() =>
      validateTradeTermsSnapshotV2({
        ...base,
        shipmentWindow: { from: "2026-08-07", to: "2026-08-01" },
      }),
    ).toThrow("ORDER_INVALID");
    expect(() =>
      validateTradeTermsSnapshotV2({
        ...base,
        incoterm: { edition: "2010", rule: "CIF", namedPlace: "Port of Manila" },
      }),
    ).toThrow("ORDER_INVALID");
    expect(() =>
      validateTradeTermsSnapshotV2({
        ...base,
        requiredDocumentTypes: ["bill-of-lading", "bill-of-lading"],
      }),
    ).toThrow("ORDER_INVALID");
  });
});
