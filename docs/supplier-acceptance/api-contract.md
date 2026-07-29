# Supplier Acceptance API Contract

All functions use authenticated Convex identity. Organization, user, wallet, buyer recipient, and decision time are never browser inputs.

## Supplier discovery

### `supplierOrders.getSummary({})`

Returns exact `requiresDecision`, `expired`, `accepted`, and `rejected` counts, up to five recent actionable orders, and readiness blockers. Requires a sole active membership in an active, verified supplier-capable organization.

### `supplierOrders.list({ paginationOpts, queueState? })`

Returns native-pagination results from supplier-first indexes. Each row contains the PO/title, buyer snapshot, revision number, total/asset, agreement state, queue state, deadline, and authoritative sort time.

## Role-aware detail

### `orderDetails.get({ orderId })`

Returns `{ viewerSide: "buyer" | "supplier", ... }`.

- Buyer authorization: active buyer organization owns the order.
- Supplier authorization: active verified supplier organization is the designated supplier.
- Supplier response is validated by a separate allowlist and never serializes buyer-only fields.
- Both responses include server-derived `fundingEligible` and authorized decision detail.

## Decisions

### `orderDecisions.accept`

Input:

```ts
{
  orderId;
  revisionId;
  expectedOrderVersion;
  expectedRevisionVersion;
  expectedTermsHash;
  idempotencyKey;
}
```

### `orderDecisions.reject`

Uses the acceptance target fields plus:

```ts
{
  reasonCode:
    | "pricing_or_totals"
    | "quantity_or_availability"
    | "delivery_schedule"
    | "commercial_terms"
    | "supplier_capacity"
    | "other";
  reasonNote?: string; // normalized, 1–500 characters when present
}
```

Both require `order:decide`, which is granted to owner, admin, procurement, and operations. Finance and viewer remain read-only.

Both return the stored decision/order/revision IDs, decision and agreement state, resulting versions, authoritative decision time, and `replay`.

The request is normalized and SHA-256 hashed. Only the digest is stored in `orderDecisionReceipts`. An identical key and request returns the stored result. Reusing a key for different normalized inputs returns `IDEMPOTENCY_CONFLICT`.

## Revision recovery

### `orderRevisions.startFromCurrent`

Input:

```ts
{
  orderId;
  expectedOrderVersion;
  expectedRevisionId;
  idempotencyKey;
}
```

Requires buyer `order:draft`, an accepted or rejected current revision, a current immutable decision, and `unfunded` settlement. It atomically clones at most 100 lines into mutable revision N+1, clears current decision/funding eligibility, and preserves prior history.

## Timeline

### `orderTimeline.list({ orderId, paginationOpts })`

Returns native-pagination revision groups newest first. Each group contains deterministically ordered `revision_started`, `revision_sent`, `revision_accepted` or `revision_rejected`, and `revision_superseded` events.

## Notifications

### `notifications.listCurrentOrganization({ paginationOpts, status? })`

Returns only notifications addressed to the active organization.

### `notifications.markRead({ notificationId })`

Marks only an active-organization notification as read. A foreign/unknown ID receives the same safe denial.

## Stable decision errors

| Code | Meaning |
|---|---|
| `ORDER_NOT_FOUND` | Unknown or foreign target |
| `ORDER_DECISION_FORBIDDEN` | Supplier context or role cannot decide |
| `ORDER_NOT_AWAITING_DECISION` | Current aggregate is not actionable |
| `ORDER_DECISION_EXPIRED` | Server time is past the exact revision deadline |
| `ORDER_ALREADY_DECIDED` | The target already has an immutable decision |
| `ORDER_REVISION_MISMATCH` | Supplied revision is not the current bound revision |
| `ORDER_TERMS_HASH_MISMATCH` | Expected/stored/recomputed hash differs |
| `ORDER_DECISION_REASON_INVALID` | Rejection reason or note is invalid |
| `ORDER_CANNOT_REVISE` | Revision N+1 is not allowed |
| `ORDER_STALE` | Expected order/revision version differs |
| `IDEMPOTENCY_CONFLICT` | One key was reused for different input |
