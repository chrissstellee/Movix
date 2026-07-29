import {
  canonicalizeOrderTermsV1,
  canonicalizeOrderTermsV2,
  type OrderTermsV1Input,
  type TradeTermsSnapshotV2,
} from "@repo/domain";

import type { Doc } from "../_generated/dataModel";

export interface OrderBlocker {
  field: string;
  message: string;
}

export function getOrderBlockers(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
  now?: number,
): OrderBlocker[] {
  const blockers: OrderBlocker[] = [];
  const required: Array<[string, unknown]> = [
    ["supplier", revision.supplierOrganizationId],
    ["supplierSnapshot", revision.supplierLegalNameSnapshot],
    ["supplierContact", revision.supplierContactSnapshot],
    ["buyerContact", revision.buyerContactSnapshot],
    ["billingAddress", revision.billingAddressSnapshot],
    ["shippingAddress", revision.shippingAddressSnapshot],
    ["purchaseOrderNumber", revision.purchaseOrderNumber],
    ["title", revision.title],
    ["timezone", revision.timezone],
    ["orderDate", revision.orderDate],
    ["issueDate", revision.issueDate],
    ["requestedDeliveryDate", revision.requestedDeliveryDate],
    ["supplierAcceptanceDeadline", revision.supplierAcceptanceDeadline],
    ["fundingDeadline", revision.fundingDeadline],
    ["asset", revision.assetKey],
    ["deliveryMethod", revision.deliveryMethod],
    ["shippingResponsibility", revision.shippingResponsibility],
    ["freightChargeTreatment", revision.freightChargeTreatment],
    ["inspectionPeriodHours", revision.inspectionPeriodHours],
    ["refundPolicy", revision.refundPolicy],
  ];
  for (const [field, value] of required) {
    if (value === undefined || value === null || value === "") {
      blockers.push({ field, message: "Required before sending." });
    }
  }
  if (lines.length < 1) {
    blockers.push({ field: "lines", message: "Add at least one line item." });
  }
  if (lines.length > 100) {
    blockers.push({ field: "lines", message: "An order may contain at most 100 lines." });
  }
  if (revision.issueDate && revision.requestedDeliveryDate) {
    if (revision.requestedDeliveryDate < revision.issueDate) {
      blockers.push({
        field: "requestedDeliveryDate",
        message: "Requested delivery cannot precede the issue date.",
      });
    }
  }
  if (
    revision.supplierAcceptanceDeadline !== undefined &&
    revision.fundingDeadline !== undefined &&
    revision.supplierAcceptanceDeadline > revision.fundingDeadline
  ) {
    blockers.push({
      field: "fundingDeadline",
      message: "Funding must not precede the supplier acceptance deadline.",
    });
  }
  if (
    now !== undefined &&
    revision.supplierAcceptanceDeadline !== undefined &&
    revision.supplierAcceptanceDeadline <= now
  ) {
    blockers.push({
      field: "supplierAcceptanceDeadline",
      message: "Supplier acceptance deadline must be in the future.",
    });
  }
  if (revision.grandTotalBaseUnits <= 0n) {
    blockers.push({ field: "totals", message: "Grand total must be positive." });
  }
  if (revision.migrationState === "legacy_incomplete") {
    blockers.push({
      field: "legacy",
      message: "Complete the pre-pivot Trade Order before issuing it.",
    });
  }
  if (revision.termsHashVersion === "order-terms-v2") {
    const agriculturalRequired: Array<[string, unknown]> = [
      ["buyerWallet", revision.buyerWalletAddressSnapshot],
      ["exporterWallet", revision.supplierWalletAddressSnapshot],
      ["destinationCountry", revision.destinationCountry],
      ["shipmentWindowFrom", revision.shipmentWindowFrom],
      ["shipmentWindowTo", revision.shipmentWindowTo],
      ["arrivalWindowFrom", revision.arrivalWindowFrom],
      ["arrivalWindowTo", revision.arrivalWindowTo],
      ["requiredDocumentTypes", revision.requiredDocumentTypes],
    ];
    for (const [field, value] of agriculturalRequired) {
      if (value === undefined || value === null) {
        blockers.push({ field, message: "Required for an agricultural Trade Order." });
      }
    }
    if (
      revision.shipmentWindowFrom &&
      revision.shipmentWindowTo &&
      revision.shipmentWindowFrom > revision.shipmentWindowTo
    ) {
      blockers.push({ field: "shipmentWindow", message: "Shipment window is reversed." });
    }
    if (
      revision.arrivalWindowFrom &&
      revision.arrivalWindowTo &&
      revision.arrivalWindowFrom > revision.arrivalWindowTo
    ) {
      blockers.push({ field: "arrivalWindow", message: "Arrival window is reversed." });
    }
    if (
      [revision.incotermEdition, revision.incotermRule, revision.incotermNamedPlace].some(
        Boolean,
      ) &&
      ![revision.incotermEdition, revision.incotermRule, revision.incotermNamedPlace].every(Boolean)
    ) {
      blockers.push({
        field: "incoterm",
        message: "Incoterm edition, rule, and named place are all required when selected.",
      });
    }
    for (const line of lines) {
      if (
        !line.name ||
        !line.originCountry ||
        !line.unitOfMeasure ||
        line.quantityCoefficient <= 0n
      ) {
        blockers.push({
          field: `line.${line.lineNumber}`,
          message: "Commodity, exact quantity/UOM, and origin are required.",
        });
      }
    }
  }
  return blockers;
}

export function buildOrderTermsV1(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
): OrderTermsV1Input {
  return {
    revisionNumber: revision.revisionNumber,
    buyer: {
      organizationId: revision.buyerOrganizationId,
      legalName: revision.buyerLegalNameSnapshot,
      tradingName: revision.buyerTradingNameSnapshot ?? null,
      contact: revision.buyerContactSnapshot,
      address: revision.billingAddressSnapshot,
    },
    supplier: {
      organizationId: revision.supplierOrganizationId!,
      legalName: revision.supplierLegalNameSnapshot!,
      tradingName: revision.supplierTradingNameSnapshot ?? null,
      contact: revision.supplierContactSnapshot,
      address: revision.shippingAddressSnapshot,
    },
    purchaseOrderNumber: revision.purchaseOrderNumber!,
    title: revision.title!,
    description: revision.description ?? null,
    buyerReference: revision.buyerReference ?? null,
    supplierReference: revision.supplierReference ?? null,
    timezone: revision.timezone!,
    asset: {
      key: revision.assetKey!,
      network: "testnet",
      code: revision.assetCode!,
      issuer: revision.assetIssuer ?? null,
      contractId: revision.assetContractId!,
      decimals: revision.assetDecimals!,
    },
    dates: {
      orderDate: revision.orderDate!,
      issueDate: revision.issueDate!,
      requestedDeliveryDate: revision.requestedDeliveryDate!,
      supplierAcceptanceDeadline: BigInt(revision.supplierAcceptanceDeadline!),
      fundingDeadline: BigInt(revision.fundingDeadline!),
      validUntil: revision.validUntil === undefined ? null : BigInt(revision.validUntil),
    },
    lines: lines.map((line) => ({
      lineNumber: line.lineNumber,
      name: line.name,
      sku: line.sku ?? null,
      supplierSku: line.supplierSku ?? null,
      description: line.description ?? null,
      quantityCoefficient: line.quantityCoefficient,
      quantityScale: line.quantityScale,
      unitOfMeasure: line.unitOfMeasure,
      unitPriceBaseUnits: line.unitPriceBaseUnits,
      discountKind: line.discountKind,
      discountValue:
        line.discountKind === "fixed"
          ? (line.discountBaseUnitsInput ?? null)
          : line.discountKind === "rate"
            ? (line.discountBps ?? null)
            : null,
      taxBps: line.taxBps,
      taxCode: line.taxCode ?? null,
      requiresInspection: line.requiresInspection,
      grossBaseUnits: line.grossBaseUnits,
      discountBaseUnits: line.discountBaseUnits,
      taxBaseUnits: line.taxBaseUnits,
      lineTotalBaseUnits: line.lineTotalBaseUnits,
    })),
    totals: {
      subtotalBaseUnits: revision.subtotalBaseUnits,
      discountTotalBaseUnits: revision.discountTotalBaseUnits,
      taxTotalBaseUnits: revision.taxTotalBaseUnits,
      shippingTotalBaseUnits: revision.shippingTotalBaseUnits,
      grandTotalBaseUnits: revision.grandTotalBaseUnits,
    },
    terms: {
      paymentMode: revision.paymentMode,
      deliveryMethod: revision.deliveryMethod!,
      shippingResponsibility: revision.shippingResponsibility!,
      freightChargeTreatment: revision.freightChargeTreatment!,
      inspectionPeriodHours: revision.inspectionPeriodHours!,
      supplierAcceptanceDeadline: BigInt(revision.supplierAcceptanceDeadline!),
      fundingDeadline: BigInt(revision.fundingDeadline!),
      refundPolicy: revision.refundPolicy!,
      autoReleasePolicy: revision.autoReleasePolicy,
      deliveryWindow: revision.deliveryWindow ?? null,
      incoterm: revision.incoterm ?? null,
      namedLocation: revision.namedLocation ?? null,
      handlingInstructions: revision.handlingInstructions ?? null,
      acceptanceCriteria: revision.acceptanceCriteria ?? null,
      warrantyText: revision.warrantyText ?? null,
      returnTerms: revision.returnTerms ?? null,
    },
    sharedNotes: revision.sharedNotes ?? null,
    buyerInternalNotes: revision.buyerInternalNotes ?? null,
  };
}

export async function hashOrderTermsV1(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
): Promise<string> {
  const bytes = canonicalizeOrderTermsV1(buildOrderTermsV1(revision, lines));
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function exactQuantity(coefficient: bigint, scale: bigint) {
  if (coefficient <= 0n || scale < 0n || scale > 6n) throw new Error("ORDER_INVALID");
  if (scale === 0n) return coefficient.toString();
  const digits = coefficient.toString().padStart(Number(scale) + 1, "0");
  const split = digits.length - Number(scale);
  const fraction = digits.slice(split).replace(/0+$/u, "");
  return fraction ? `${digits.slice(0, split)}.${fraction}` : digits.slice(0, split);
}

export function buildOrderTermsV2(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
): TradeTermsSnapshotV2 {
  return {
    schemaVersion: "order-terms-v2",
    revisionNumber: revision.revisionNumber,
    parties: {
      importer: {
        organizationId: revision.buyerOrganizationId,
        legalName: revision.buyerLegalNameSnapshot,
        tradingName: revision.buyerTradingNameSnapshot ?? null,
      },
      exporter: {
        organizationId: revision.supplierOrganizationId!,
        legalName: revision.supplierLegalNameSnapshot!,
        tradingName: revision.supplierTradingNameSnapshot ?? null,
      },
    },
    accounts: {
      importer: revision.buyerWalletAddressSnapshot!,
      exporter: revision.supplierWalletAddressSnapshot!,
    },
    asset: {
      network: "testnet",
      code: revision.assetCode!,
      issuer: revision.assetIssuer ?? null,
      contractId: revision.assetContractId!,
      decimals: revision.assetDecimals!,
    },
    amountBaseUnits: revision.grandTotalBaseUnits,
    dates: {
      orderDate: revision.orderDate!,
      issueDate: revision.issueDate!,
      requestedDeliveryDate: revision.requestedDeliveryDate!,
      supplierAcceptanceDeadline: BigInt(revision.supplierAcceptanceDeadline!),
      fundingDeadline: BigInt(revision.fundingDeadline!),
      validUntil: revision.validUntil === undefined ? null : BigInt(revision.validUntil),
    },
    commodityLines: lines.map((line) => ({
      lineNumber: line.lineNumber,
      name: line.name,
      category: line.category ?? null,
      varietyOrGrade: line.varietyOrGrade ?? null,
      specification: line.specification ?? line.description ?? null,
      quantity: exactQuantity(line.quantityCoefficient, line.quantityScale),
      unitOfMeasure: line.unitOfMeasure,
      originCountry: line.originCountry!,
      unitPriceBaseUnits: line.unitPriceBaseUnits,
      discount: {
        kind: line.discountKind,
        baseUnits: line.discountKind === "fixed" ? (line.discountBaseUnitsInput ?? null) : null,
        bps: line.discountKind === "rate" ? (line.discountBps ?? null) : null,
      },
      tax: {
        bps: line.taxBps,
        code: line.taxCode ?? null,
      },
      amounts: {
        grossBaseUnits: line.grossBaseUnits,
        discountBaseUnits: line.discountBaseUnits,
        taxBaseUnits: line.taxBaseUnits,
        lineTotalBaseUnits: line.lineTotalBaseUnits,
      },
    })),
    totals: {
      subtotalBaseUnits: revision.subtotalBaseUnits,
      discountTotalBaseUnits: revision.discountTotalBaseUnits,
      taxTotalBaseUnits: revision.taxTotalBaseUnits,
      shippingTotalBaseUnits: revision.shippingTotalBaseUnits,
      grandTotalBaseUnits: revision.grandTotalBaseUnits,
    },
    destinationCountry: revision.destinationCountry!,
    shipmentWindow: {
      from: revision.shipmentWindowFrom!,
      to: revision.shipmentWindowTo!,
    },
    arrivalWindow: {
      from: revision.arrivalWindowFrom!,
      to: revision.arrivalWindowTo!,
    },
    incoterm:
      revision.incotermEdition && revision.incotermRule && revision.incotermNamedPlace
        ? {
            edition: revision.incotermEdition,
            rule: revision.incotermRule,
            namedPlace: revision.incotermNamedPlace,
          }
        : null,
    requiredDocumentTypes: revision.requiredDocumentTypes ?? [],
    releaseConditions: [
      `payment:${revision.paymentMode}`,
      `auto-release:${revision.autoReleasePolicy}`,
      `refund:${revision.refundPolicy ?? "unspecified"}`,
      `inspection-hours:${revision.inspectionPeriodHours?.toString() ?? "0"}`,
    ],
  };
}

export async function hashOrderTermsV2(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
) {
  const bytes = canonicalizeOrderTermsV2(buildOrderTermsV2(revision, lines));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function termsHashVersion(revision: Doc<"orderRevisions">) {
  return revision.termsHashVersion ?? "order-terms-v1";
}

export function hashOrderTerms(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
) {
  return termsHashVersion(revision) === "order-terms-v2"
    ? hashOrderTermsV2(revision, lines)
    : hashOrderTermsV1(revision, lines);
}
