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

export const ORDER_TERMS_V2_DOMAIN = "MOVIX_ORDER_TERMS_V2";
export const supportedIncotermRulesV2 = [
  "EXW",
  "FCA",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
] as const;

export interface TradePartySnapshotV2 {
  organizationId: string;
  legalName: string;
  tradingName?: string | null;
}

export interface TradeAccountsSnapshotV2 {
  importer: string;
  exporter: string;
}

export interface TradeAssetSnapshotV2 {
  network: string;
  code: string;
  issuer: string | null;
  contractId: string;
  decimals: bigint;
}

export interface CommodityLineSnapshotV2 {
  lineNumber: bigint;
  name: string;
  category?: string | null;
  varietyOrGrade?: string | null;
  specification?: string | null;
  quantity: string;
  unitOfMeasure: string;
  originCountry: string;
  unitPriceBaseUnits: bigint;
  discount: {
    kind: "none" | "fixed" | "rate";
    baseUnits: bigint | null;
    bps: bigint | null;
  };
  tax: {
    bps: bigint;
    code: string | null;
  };
  amounts: OrderLineAmounts;
}

export interface TradeDateWindowV2 {
  from: string;
  to: string;
}

export interface TradeOrderDatesV2 {
  orderDate: string;
  issueDate: string;
  requestedDeliveryDate: string;
  supplierAcceptanceDeadline: bigint;
  fundingDeadline: bigint;
  validUntil: bigint | null;
}

export interface IncotermSnapshotV2 {
  edition: string;
  rule: string;
  namedPlace: string;
}

export interface TradeTermsSnapshotV2 {
  schemaVersion: "order-terms-v2";
  revisionNumber: bigint;
  parties: {
    importer: TradePartySnapshotV2;
    exporter: TradePartySnapshotV2;
  };
  accounts: TradeAccountsSnapshotV2;
  asset: TradeAssetSnapshotV2;
  amountBaseUnits: bigint;
  dates: TradeOrderDatesV2;
  commodityLines: CommodityLineSnapshotV2[];
  totals: OrderTotals;
  destinationCountry: string;
  shipmentWindow: TradeDateWindowV2;
  arrivalWindow: TradeDateWindowV2;
  incoterm?: IncotermSnapshotV2 | null;
  requiredDocumentTypes: string[];
  releaseConditions: string[];
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

function requireCanonicalText(value: unknown, maximumLength = 500): string {
  if (typeof value !== "string") {
    orderError("ORDER_INVALID");
  }
  const normalized = normalizeCanonicalText(value);
  if (
    normalized.length < 1 ||
    normalized.length > maximumLength ||
    /[\p{Cc}\p{Cf}]/u.test(normalized.replace(/\n/gu, ""))
  ) {
    orderError("ORDER_INVALID");
  }
  return normalized;
}

function requireCountryCode(value: unknown): void {
  if (!/^[A-Z]{2}$/u.test(requireCanonicalText(value, 2))) {
    orderError("ORDER_INVALID");
  }
}

function requireDate(value: unknown): string {
  const date = requireCanonicalText(value, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (match === null) {
    orderError("ORDER_INVALID");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    orderError("ORDER_INVALID");
  }
  return date;
}

function requireInt64(value: unknown, minimum: bigint): bigint {
  if (typeof value !== "bigint" || value < minimum || value > MAX_CONVEX_INT64) {
    orderError("ORDER_INVALID");
  }
  return value;
}

function validatePartyV2(party: unknown): void {
  if (party === null || typeof party !== "object") {
    orderError("ORDER_INVALID");
  }
  const snapshot = party as TradePartySnapshotV2;
  requireCanonicalText(snapshot.organizationId, 200);
  requireCanonicalText(snapshot.legalName, 300);
  if (snapshot.tradingName !== undefined && snapshot.tradingName !== null) {
    requireCanonicalText(snapshot.tradingName, 300);
  }
}

function validateStringSet(values: unknown, maximumItems: number): void {
  if (!Array.isArray(values) || values.length > maximumItems) {
    orderError("ORDER_INVALID");
  }
  const unique = new Set<string>();
  for (const value of values) {
    const normalized = requireCanonicalText(value, 100);
    if (unique.has(normalized)) {
      orderError("ORDER_INVALID");
    }
    unique.add(normalized);
  }
}

export function validateTradeTermsSnapshotV2(input: TradeTermsSnapshotV2): void {
  if (input === null || typeof input !== "object" || input.schemaVersion !== "order-terms-v2") {
    orderError("ORDER_INVALID");
  }
  if (
    typeof input.revisionNumber !== "bigint" ||
    input.revisionNumber < 1n ||
    input.revisionNumber > MAX_CONVEX_INT64
  ) {
    orderError("ORDER_INVALID");
  }

  validatePartyV2(input.parties?.importer);
  validatePartyV2(input.parties?.exporter);
  requireCanonicalText(input.accounts?.importer, 200);
  requireCanonicalText(input.accounts?.exporter, 200);

  const asset = input.asset;
  if (asset === null || typeof asset !== "object") {
    orderError("ORDER_INVALID");
  }
  requireCanonicalText(asset.network, 50);
  requireCanonicalText(asset.code, 32);
  if (asset.issuer !== null) {
    requireCanonicalText(asset.issuer, 200);
  }
  requireCanonicalText(asset.contractId, 200);
  if (typeof asset.decimals !== "bigint" || asset.decimals < 0n || asset.decimals > 18n) {
    orderError("ORDER_INVALID");
  }
  if (
    typeof input.amountBaseUnits !== "bigint" ||
    input.amountBaseUnits <= 0n ||
    input.amountBaseUnits > MAX_CONVEX_INT64
  ) {
    orderError("ORDER_INVALID");
  }
  requireDate(input.dates?.orderDate);
  requireDate(input.dates?.issueDate);
  requireDate(input.dates?.requestedDeliveryDate);
  requireInt64(input.dates?.supplierAcceptanceDeadline, 1n);
  requireInt64(input.dates?.fundingDeadline, 1n);
  if (input.dates?.validUntil !== null) {
    requireInt64(input.dates?.validUntil, 1n);
  }

  if (
    !Array.isArray(input.commodityLines) ||
    input.commodityLines.length < 1 ||
    input.commodityLines.length > 100
  ) {
    orderError("ORDER_INVALID");
  }
  const lineNumbers = new Set<bigint>();
  for (const line of input.commodityLines) {
    if (
      line === null ||
      typeof line !== "object" ||
      typeof line.lineNumber !== "bigint" ||
      line.lineNumber < 1n ||
      line.lineNumber > MAX_CONVEX_INT64 ||
      lineNumbers.has(line.lineNumber)
    ) {
      orderError("ORDER_INVALID");
    }
    lineNumbers.add(line.lineNumber);
    requireCanonicalText(line.name, 300);
    for (const optional of [line.category, line.varietyOrGrade, line.specification]) {
      if (optional !== undefined && optional !== null) {
        requireCanonicalText(optional, 1_000);
      }
    }
    const quantity = requireCanonicalText(line.quantity, 100);
    if (quantity === "0" || !/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/u.test(quantity)) {
      orderError("ORDER_INVALID");
    }
    if (!/^[A-Z][A-Z0-9_-]{0,31}$/u.test(requireCanonicalText(line.unitOfMeasure, 32))) {
      orderError("ORDER_INVALID");
    }
    requireCountryCode(line.originCountry);
    requireInt64(line.unitPriceBaseUnits, 1n);
    if (
      line.discount === null ||
      typeof line.discount !== "object" ||
      !["none", "fixed", "rate"].includes(line.discount.kind)
    ) {
      orderError("ORDER_INVALID");
    }
    if (line.discount.kind === "none") {
      if (line.discount.baseUnits !== null || line.discount.bps !== null) {
        orderError("ORDER_INVALID");
      }
    } else if (line.discount.kind === "fixed") {
      if (line.discount.bps !== null) {
        orderError("ORDER_INVALID");
      }
      requireInt64(line.discount.baseUnits, 0n);
    } else {
      if (line.discount.baseUnits !== null || requireInt64(line.discount.bps, 0n) > 10_000n) {
        orderError("ORDER_INVALID");
      }
    }
    if (line.tax === null || typeof line.tax !== "object") {
      orderError("ORDER_INVALID");
    }
    if (requireInt64(line.tax.bps, 0n) > 10_000n) {
      orderError("ORDER_INVALID");
    }
    if (line.tax.code !== null) {
      requireCanonicalText(line.tax.code, 100);
    }
    if (line.amounts === null || typeof line.amounts !== "object") {
      orderError("ORDER_INVALID");
    }
    requireInt64(line.amounts.grossBaseUnits, 0n);
    requireInt64(line.amounts.discountBaseUnits, 0n);
    requireInt64(line.amounts.taxBaseUnits, 0n);
    requireInt64(line.amounts.lineTotalBaseUnits, 0n);
  }
  if (input.totals === null || typeof input.totals !== "object") {
    orderError("ORDER_INVALID");
  }
  requireInt64(input.totals.subtotalBaseUnits, 0n);
  requireInt64(input.totals.discountTotalBaseUnits, 0n);
  requireInt64(input.totals.taxTotalBaseUnits, 0n);
  requireInt64(input.totals.shippingTotalBaseUnits, 0n);
  requireInt64(input.totals.grandTotalBaseUnits, 1n);
  requireCountryCode(input.destinationCountry);

  const shipmentFrom = requireDate(input.shipmentWindow?.from);
  const shipmentTo = requireDate(input.shipmentWindow?.to);
  const arrivalFrom = requireDate(input.arrivalWindow?.from);
  const arrivalTo = requireDate(input.arrivalWindow?.to);
  if (shipmentFrom > shipmentTo || arrivalFrom > arrivalTo || shipmentFrom > arrivalTo) {
    orderError("ORDER_INVALID");
  }

  if (input.incoterm !== undefined && input.incoterm !== null) {
    const edition = requireCanonicalText(input.incoterm.edition, 20);
    const rule = requireCanonicalText(input.incoterm.rule, 20);
    if (
      edition !== "2020" ||
      !supportedIncotermRulesV2.includes(rule as (typeof supportedIncotermRulesV2)[number])
    ) {
      orderError("ORDER_INVALID");
    }
    requireCanonicalText(input.incoterm.namedPlace, 300);
  }
  validateStringSet(input.requiredDocumentTypes, 100);
  validateStringSet(input.releaseConditions, 100);
}

function compareCanonicalText(left: string, right: string): number {
  const normalizedLeft = normalizeCanonicalText(left);
  const normalizedRight = normalizeCanonicalText(right);
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

export function canonicalizeOrderTermsV2(input: TradeTermsSnapshotV2): Uint8Array {
  validateTradeTermsSnapshotV2(input);
  const payload = {
    schemaVersion: input.schemaVersion,
    revisionNumber: input.revisionNumber,
    parties: {
      importer: {
        organizationId: input.parties.importer.organizationId,
        legalName: input.parties.importer.legalName,
        tradingName: input.parties.importer.tradingName ?? null,
      },
      exporter: {
        organizationId: input.parties.exporter.organizationId,
        legalName: input.parties.exporter.legalName,
        tradingName: input.parties.exporter.tradingName ?? null,
      },
    },
    accounts: input.accounts,
    asset: input.asset,
    amountBaseUnits: input.amountBaseUnits,
    dates: input.dates,
    commodityLines: [...input.commodityLines]
      .sort((left, right) =>
        left.lineNumber < right.lineNumber ? -1 : left.lineNumber > right.lineNumber ? 1 : 0,
      )
      .map((line) => ({
        lineNumber: line.lineNumber,
        name: line.name,
        category: line.category ?? null,
        varietyOrGrade: line.varietyOrGrade ?? null,
        specification: line.specification ?? null,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        originCountry: line.originCountry,
        unitPriceBaseUnits: line.unitPriceBaseUnits,
        discount: {
          kind: line.discount.kind,
          baseUnits: line.discount.baseUnits,
          bps: line.discount.bps,
        },
        tax: {
          bps: line.tax.bps,
          code: line.tax.code,
        },
        amounts: line.amounts,
      })),
    totals: input.totals,
    destinationCountry: input.destinationCountry,
    shipmentWindow: input.shipmentWindow,
    arrivalWindow: input.arrivalWindow,
    incoterm: input.incoterm ?? null,
    requiredDocumentTypes: [...input.requiredDocumentTypes].sort(compareCanonicalText),
    releaseConditions: [...input.releaseConditions].sort(compareCanonicalText),
  };
  const canonicalJson = JSON.stringify(canonicalValue(payload));
  return new TextEncoder().encode(`${ORDER_TERMS_V2_DOMAIN}\u0000${canonicalJson}`);
}
