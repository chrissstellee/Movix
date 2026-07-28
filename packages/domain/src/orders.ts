export const MAX_CONVEX_INT64 = 9_223_372_036_854_775_807n;
export const ORDER_TERMS_DOMAIN = "MOVIX_ORDER_TERMS_V1";
export const supportedOrderAssetKeys = ["testnet:XLM", "testnet:USDC"] as const;

export type SupportedOrderAssetKey = (typeof supportedOrderAssetKeys)[number];
export type OrderAssetCode = "XLM" | "USDC";

export type OrderDiscount =
  | { kind: "none" }
  | { kind: "fixed"; baseUnits: bigint }
  | { kind: "rate"; bps: bigint };

export interface OrderLineCalculationInput {
  quantityCoefficient: bigint;
  quantityScale: number;
  unitPriceBaseUnits: bigint;
  discount: OrderDiscount;
  taxBps: bigint;
}

export interface OrderLineAmounts {
  grossBaseUnits: bigint;
  discountBaseUnits: bigint;
  taxBaseUnits: bigint;
  lineTotalBaseUnits: bigint;
}

export interface OrderTotals {
  subtotalBaseUnits: bigint;
  discountTotalBaseUnits: bigint;
  taxTotalBaseUnits: bigint;
  shippingTotalBaseUnits: bigint;
  grandTotalBaseUnits: bigint;
}

export interface OrderPartyTermsSnapshot {
  organizationId: string;
  legalName: string;
  tradingName?: string | null;
  contact?: Record<string, string | null>;
  address?: Record<string, string | null>;
}

export interface OrderTermsLineV1 {
  lineNumber: bigint;
  name: string;
  sku?: string | null;
  supplierSku?: string | null;
  description?: string | null;
  quantityCoefficient: bigint;
  quantityScale: bigint;
  unitOfMeasure?: string | null;
  unitPriceBaseUnits: bigint;
  discountKind?: string | null;
  discountValue?: bigint | null;
  taxBps?: bigint | null;
  taxCode?: string | null;
  requiresInspection?: boolean;
  grossBaseUnits: bigint;
  discountBaseUnits: bigint;
  taxBaseUnits: bigint;
  lineTotalBaseUnits: bigint;
}

export interface OrderTermsV1Input {
  revisionNumber: bigint;
  buyer: OrderPartyTermsSnapshot;
  supplier: OrderPartyTermsSnapshot;
  purchaseOrderNumber: string;
  title: string;
  description?: string | null;
  buyerReference?: string | null;
  supplierReference?: string | null;
  timezone: string;
  asset: {
    key: SupportedOrderAssetKey;
    network: "testnet";
    code: OrderAssetCode;
    issuer: string | null;
    contractId: string;
    decimals: bigint;
  };
  dates?: Record<string, string | bigint | null>;
  lines: OrderTermsLineV1[];
  totals: OrderTotals;
  terms: Record<string, string | bigint | boolean | null>;
  sharedNotes?: string | null;
  buyerInternalNotes?: string | null;
}

function orderError(code: "ORDER_INVALID" | "AMOUNT_INVALID" | "AMOUNT_OVERFLOW"): never {
  throw new Error(code);
}

function checked(value: bigint): bigint {
  if (value < 0n) {
    orderError("AMOUNT_INVALID");
  }
  if (value > MAX_CONVEX_INT64) {
    orderError("AMOUNT_OVERFLOW");
  }
  return value;
}

function checkedAdd(left: bigint, right: bigint): bigint {
  return checked(left + right);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    orderError("AMOUNT_INVALID");
  }
  return checked((numerator + denominator / 2n) / denominator);
}

export function normalizePurchaseOrderNumber(value: string): {
  display: string;
  comparison: string;
} {
  const display = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (display.length < 1 || display.length > 120 || /[\p{Cc}\p{Cf}]/u.test(display)) {
    orderError("ORDER_INVALID");
  }
  return { display, comparison: display.toLocaleLowerCase("und") };
}

export function calculateOrderLine(input: OrderLineCalculationInput): OrderLineAmounts {
  if (
    input.quantityCoefficient <= 0n ||
    !Number.isInteger(input.quantityScale) ||
    input.quantityScale < 0 ||
    input.quantityScale > 6 ||
    input.unitPriceBaseUnits <= 0n ||
    input.taxBps < 0n ||
    input.taxBps > 10_000n
  ) {
    orderError("AMOUNT_INVALID");
  }

  const denominator = 10n ** BigInt(input.quantityScale);
  const grossBaseUnits = roundHalfUp(
    input.quantityCoefficient * input.unitPriceBaseUnits,
    denominator,
  );
  let discountBaseUnits = 0n;
  if (input.discount.kind === "fixed") {
    discountBaseUnits = checked(input.discount.baseUnits);
  } else if (input.discount.kind === "rate") {
    if (input.discount.bps < 0n || input.discount.bps > 10_000n) {
      orderError("AMOUNT_INVALID");
    }
    discountBaseUnits = roundHalfUp(grossBaseUnits * input.discount.bps, 10_000n);
  }
  if (discountBaseUnits > grossBaseUnits) {
    orderError("AMOUNT_INVALID");
  }

  const discounted = grossBaseUnits - discountBaseUnits;
  const taxBaseUnits = roundHalfUp(discounted * input.taxBps, 10_000n);
  const lineTotalBaseUnits = checkedAdd(discounted, taxBaseUnits);
  return { grossBaseUnits, discountBaseUnits, taxBaseUnits, lineTotalBaseUnits };
}

export function calculateOrderTotals(
  lines: readonly OrderLineAmounts[],
  shippingTotalBaseUnits: bigint,
): OrderTotals {
  if (lines.length < 1 || lines.length > 100) {
    orderError("AMOUNT_INVALID");
  }
  checked(shippingTotalBaseUnits);

  let subtotalBaseUnits = 0n;
  let discountTotalBaseUnits = 0n;
  let taxTotalBaseUnits = 0n;
  for (const line of lines) {
    subtotalBaseUnits = checkedAdd(subtotalBaseUnits, checked(line.grossBaseUnits));
    discountTotalBaseUnits = checkedAdd(discountTotalBaseUnits, checked(line.discountBaseUnits));
    taxTotalBaseUnits = checkedAdd(taxTotalBaseUnits, checked(line.taxBaseUnits));
    if (
      line.discountBaseUnits > line.grossBaseUnits ||
      line.lineTotalBaseUnits !== line.grossBaseUnits - line.discountBaseUnits + line.taxBaseUnits
    ) {
      orderError("AMOUNT_INVALID");
    }
  }

  const grandTotalBaseUnits = checked(
    subtotalBaseUnits - discountTotalBaseUnits + taxTotalBaseUnits + shippingTotalBaseUnits,
  );
  if (grandTotalBaseUnits <= 0n) {
    orderError("AMOUNT_INVALID");
  }
  return {
    subtotalBaseUnits,
    discountTotalBaseUnits,
    taxTotalBaseUnits,
    shippingTotalBaseUnits,
    grandTotalBaseUnits,
  };
}

export function formatOrderAmount(
  baseUnits: bigint,
  decimals: number,
  assetCode: OrderAssetCode,
): string {
  if (baseUnits < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    orderError("AMOUNT_INVALID");
  }
  const scale = 10n ** BigInt(decimals);
  const whole = baseUnits / scale;
  const fraction =
    decimals === 0
      ? ""
      : (baseUnits % scale).toString().padStart(decimals, "0").replace(/0+$/u, "");
  return `${fraction ? `${whole}.${fraction}` : whole.toString()} ${assetCode}`;
}

function normalizeCanonicalText(value: string): string {
  return value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (typeof value === "string") {
    return normalizeCanonicalText(value);
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      const item = input[key];
      output[key] = item === undefined ? null : canonicalValue(item);
    }
    return output;
  }
  return null;
}

export function canonicalizeOrderTermsV1(input: OrderTermsV1Input): Uint8Array {
  const payload = {
    revisionNumber: input.revisionNumber,
    buyer: input.buyer,
    supplier: input.supplier,
    purchaseOrderNumber: input.purchaseOrderNumber,
    title: input.title,
    description: input.description ?? null,
    buyerReference: input.buyerReference ?? null,
    supplierReference: input.supplierReference ?? null,
    timezone: input.timezone,
    asset: input.asset,
    dates: input.dates ?? {},
    lines: [...input.lines].sort((left, right) =>
      left.lineNumber < right.lineNumber ? -1 : left.lineNumber > right.lineNumber ? 1 : 0,
    ),
    totals: input.totals,
    terms: input.terms,
    sharedNotes: input.sharedNotes ?? null,
  };
  const canonicalJson = JSON.stringify(canonicalValue(payload));
  return new TextEncoder().encode(`${ORDER_TERMS_DOMAIN}\u0000${canonicalJson}`);
}
