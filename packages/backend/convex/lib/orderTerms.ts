import { canonicalizeOrderTermsV1, type OrderTermsV1Input } from "@repo/domain";

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
