# Supplier Acceptance Data and Validation

## Data model

`orders` gains optional migration-safe references and projections:

- `acceptedRevisionId`
- `currentDecisionId`
- `decidedAt`
- `decisionSortTimestamp`
- `decisionWindowExpiredAt`
- `supplierQueueState`

`orderRevisions` gains `supersedesRevisionId` and `supersededAt`.

`orderRevisionDecisions` is immutable commercial history: order/revision identity, revision number, buyer/supplier organizations, accepted/rejected outcome, exact terms hash, optional structured rejection detail, server-derived actor user/wallet, and time.

`orderDecisionReceipts` stores supplier scope, command/key, SHA-256 request fingerprint, decision identity, exact result versions, and decision time. It does not store plaintext request payloads.

`supplierOrderCounts` stores additive exact counts for actionable, expired, accepted, and rejected orders.

## Queue states

| State | Definition |
|---|---|
| `not_queued` | Draft/cancelled or otherwise outside supplier decision history |
| `requires_decision` | Current sent, frozen, undecided revision before or at deadline |
| `expired` | Current sent revision passed the deadline without a decision |
| `accepted` | Current revision has an immutable accepted decision |
| `rejected` | Current revision has an immutable rejected decision |

The supplier composite index is `by_supplier_queue_sortTimestamp` over supplier organization, queue state, and sort timestamp. The shortened name satisfies Convex’s 64-character identifier limit while preserving the full field list in schema.

## Validation

- Decision authorization derives the active supplier from the authenticated session and sole active membership.
- The designated supplier, current revision, frozen marker, stored hash, recomputed hash, expected versions, server deadline, settlement state, and lack of a prior revision decision are checked in the mutation.
- Rejection notes are NFKC-normalized, trimmed, internal whitespace-collapsed, control-character rejected, and limited to 500 characters.
- Revision cloning is bounded to 100 lines and omits hash, frozen time, decision references, and prior supersession metadata.

## Supplier projection allowlist

The supplier receives only frozen transaction snapshots: buyer/supplier names and contacts, billing/shipping addresses, commercial header/references/dates, all canonical line fields, totals/asset, delivery/inspection/refund terms, shared notes, revision number, deadline, frozen time, and full hash.

The validator excludes buyer internal notes, cost center, project code, live profiles, identity/session internals, and generic audit records.

## Funding eligibility

```text
agreementStatus == accepted
AND settlementStatus == unfunded
AND currentRevisionId == acceptedRevisionId
AND decision == accepted
AND decision.revisionId == currentRevisionId
AND decision.termsHash == currentRevision.termsHash
```

## Widen–migrate–narrow

1. Deploy optional fields/tables and dual-write queue/count state with Sprint 5 UI disabled.
2. Run `migrations:sprint5OrderInventory` page by page and preserve its immutable output.
3. Abort if a sent order lacks frozen identity or an accepted/rejected order lacks a matching immutable decision. Never manufacture actor, wallet, hash, or time.
4. Dry-run and then execute `migrations:backfillSupplierQueueState` with resumable `@convex-dev/migrations`.
5. Run `migrations:reconcileSupplierOrderCounts` for every supplier organization. `exact` and `matches` must both be true.
6. Activate the supplier composite index/APIs/UI.
7. Make `supplierQueueState` required only after every target deployment reports zero missing values.

The repository contains the widen and migration code. No target deployment migration was run as part of local implementation.

## Rollback

Before activation, roll back by disabling Sprint 5 UI/functions and leaving additive tables/optional fields intact. Do not delete decision history. If count drift appears, disable dashboard counts, inventory affected suppliers, repair projections from canonical orders, reconcile, then re-enable.
