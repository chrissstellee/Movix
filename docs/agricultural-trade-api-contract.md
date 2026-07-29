# Agricultural Trade API Compatibility Contract

> Status: Implemented in the development deployment; release sign-off pending  
> Legacy implementation authority: `docs/buyer-procurement/api-contract.md` and `docs/supplier-acceptance/api-contract.md`

## Policy

Sprint 6 adds agricultural fields and thin canonical aliases. Existing Convex functions, authorization, idempotency, record IDs, and response behavior remain available. Aliases delegate to existing logic; they do not fork it.

| Canonical name | Compatibility target |
|---|---|
| `tradeOrders.createDraft` | `orderDrafts.create` |
| `tradeOrders.saveTradeTerms` | `orderDrafts.saveAgriculturalTerms` |
| `tradeOrders.getReview` | `orderDrafts.getReview` |
| `tradeOrders.send` | `orders.send` |
| `tradeOrders.get` | `orderDetails.get` |
| `exporterDirectory.resolve` | `supplierDirectory.resolveExact` |
| `exporterOrders.getSummary` | `supplierOrders.getSummary` |
| `exporterOrders.list` | `supplierOrders.list` |
| `tradeOrderDecisions.accept/reject` | `orderDecisions.accept/reject` |
| `tradeOrderRevisions.startFromCurrent` | `orderRevisions.startFromCurrent` |

## Trade Order v2 input

New Trade Orders add:

```ts
{
  commodity: {
    name: string;
    category?: string;
    varietyOrGrade?: string;
    quantity: string; // canonical exact decimal, never JS number
    unitOfMeasure: string;
    originCountry: string;
    unitPriceBaseUnits: bigint;
    discount: {
      kind: "none" | "fixed" | "rate";
      baseUnits?: bigint;
      bps?: bigint;
    };
    tax: { bps: bigint; code?: string };
  };
  dates: {
    orderDate: string;
    issueDate: string;
    requestedDeliveryDate: string;
    supplierAcceptanceDeadline: bigint;
    fundingDeadline: bigint;
    validUntil?: bigint;
  };
  totals: {
    subtotalBaseUnits: bigint;
    discountTotalBaseUnits: bigint;
    taxTotalBaseUnits: bigint;
    shippingTotalBaseUnits: bigint;
    grandTotalBaseUnits: bigint;
  };
  destinationCountry: string;
  shipmentWindow: { from: string; to: string }; // ISO calendar dates
  arrivalWindow: { from: string; to: string };
  incoterm?: {
    edition: string;
    rule: string;
    namedPlace: string;
  };
  requiredDocumentTypes?: string[];
  termsHashVersion: "order-terms-v2";
}
```

Validators reject unsupported country/UOM/Incoterm values, reversed windows, imprecise quantities, incomplete Incoterms, unverified consequential actors, and incomplete v2 terms.

## Response terminology

User-facing clients render Importer and Exporter terminology. For response compatibility, `orderDetails.get` and the `tradeOrders.get` alias continue to return `viewerSide: "buyer" | "supplier"`; the web adapter maps those technical values to current labels. Stored roles and legacy responses remain stable during the compatibility window.

## Verification and invitation APIs

| Module | Operations |
|---|---|
| `organizationVerification` | `current`, `submit`; operator-only `review` is internal |
| `exporterInvitations` | `issue`, `getByToken`, `accept`, `revoke` |

Verification and invitation mutations derive the user, organization, wallet, membership, and capability server-side. Consequential Trade Order, invitation, document, and Shipment actions require an explicitly verified organization.

## Trade Documents

Target functions:

- `tradeDocuments.createUpload`
- `tradeDocuments.completeUpload`
- `tradeDocuments.list`
- `tradeDocuments.createDownloadUrl`
- `tradeDocuments.replace`
- `tradeDocuments.review`

Every operation derives the active user and organization server-side. Unknown and foreign IDs receive the same safe denial. Upload completion verifies object metadata, digest, size, and MIME type before creating an immutable version in `pending` scan state.

Document replacement checks both current version and side visibility. New versions start in `pending`; only the internal scanner can mark them `clean` or `rejected`. Download requires a clean, side-visible version. Review requires a clean, unreviewed version and a verified counterparty other than the uploader. Upload, scan, and review transitions create audits.

## Shipments

Implemented functions:

- `shipments.create`
- `shipments.recordStatus`
- `shipments.get`

Shipment creation is Exporter-only, requires the exact currently accepted revision, validates route data against that revision, and binds an optional escrow only after server-side order, party, network, and contract checks. Dispatch and Delivery Confirmation require exact clean document versions. The server recomputes the evidence-manifest digest from order, accepted revision, escrow, contract, network, and document digests before accepting the transition. Only the Importer can record Delivery Confirmation.

## Stable Sprint 6 errors

| Code | Meaning |
|---|---|
| `ORGANIZATION_VERIFICATION_REQUIRED` | Consequential action is blocked until verification |
| `TRADE_TERMS_INCOMPLETE` | Required v2 agricultural terms are missing |
| `TRADE_TERMS_INVALID` | Country, UOM, quantity, date, or Incoterm validation failed |
| `TRADE_ORDER_LEGACY_INCOMPLETE` | A pre-pivot draft requires completion and re-acceptance |
| `TRADE_ORDER_REACCEPTANCE_REQUIRED` | Material terms changed after acceptance |
| `TRADE_DOCUMENT_FORBIDDEN` | Active organization cannot access the document |
| `TRADE_DOCUMENT_INVALID` | File metadata, digest, type, size, or scan state is invalid |
| `TRADE_DOCUMENT_STALE` | Document version changed; reload before acting |

Existing stable auth, order, decision, idempotency, amount, asset, and stale-write errors remain valid.

## Deprecation gate

No legacy route or function is removed in Sprint 6. Removal requires two stable releases, zero observed legacy usage, full data reconciliation, no active legacy drafts, published notice, and a tested rollback plan.
