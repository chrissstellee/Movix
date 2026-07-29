# Buyer procurement data and validation

Status: canonical Sprint 4 model  
Scope authority: [Sprint 4 detailed specification](../Movix-Sprint-04-Buyer-Procurement-Detailed.md)

## Records

- `relationships`: buyer/supplier pair, active/provisional/paused state, optional invite/default references.
- `orders`: mutable list projection and lifecycle root; buyer/supplier IDs, normalized PO key, status dimensions, current revision, cancellation/send timestamps, stable sort time, version.
- `orderRevisions`: complete party/contact/address snapshots, dates, resolved asset metadata, terms, exact totals, hash, frozen timestamp, version.
- `orderLines`: relational canonical inputs plus derived gross, discount, tax, and line total.
- `orderCommandReceipts`: buyer + command + key fingerprint and recorded result for create/send/cancel.
- `orderDashboardCounts`: one row per organization and side, with exact attention counts.
- `notifications`: required recipient organization, optional user, safe route and event metadata.
- `auditEvents`: bounded identifiers, action, changed field names, and correlation ID; no commercial payload.

## Review visibility

The buyer review projection contains the saved buyer and supplier names,
contact/address snapshots, header and terms fields collected by the current
five-step flow, canonical lines, exact totals, validation blockers, and optional
backend hash preview. The browser displays these server-returned values; it does not
recalculate a competing commercial snapshot.

Buyer internal notes are visible only in the buyer-authorized review and are labeled
buyer-only. They are excluded from supplier-visible terms and from the canonical
hash. Contact and address snapshots are commercial data: they may be rendered to
the authorized buyer but must not be copied into logs, analytics, documentation, or
evidence.

## Normalization and dates

PO numbers are NFKC-normalized, trimmed, internal whitespace collapsed, and compared case-insensitively. Display text preserves a normalized human form while uniqueness uses the comparison key. Bounded free text rejects control/format characters.

Calendar dates are `YYYY-MM-DD`. Deadlines are epoch milliseconds interpreted using the saved organization/user timezone label. Delivery cannot precede issue; supplier acceptance cannot follow funding; send requires a future acceptance deadline. UI datetime-local values are converted to epoch milliseconds before submission.

## Exact amounts

All persisted money values use `bigint` base units and must fit Convex signed `int64`. XLM and allowlisted Testnet USDC metadata—including code, issuer, SAC contract ID, decimals, and network—comes from server configuration.

For each line:

1. `gross = roundHalfUp(quantityCoefficient × unitPrice / 10^quantityScale)`
2. Discount is either zero, fixed base units, or `roundHalfUp(gross × bps / 10_000)`.
3. `taxable = gross - discount`.
4. `tax = roundHalfUp(taxable × taxBps / 10_000)`.
5. `lineTotal = taxable + tax`.

Order totals sum line gross/discount/tax, add non-negative shipping, and check every intermediate/result for int64 overflow. The backend recomputes after line/terms changes and again immediately before send.

## Canonical terms and hash

`order-terms-v1` bytes are:

1. ASCII domain prefix `MOVIX_ORDER_TERMS_V1` followed by NUL.
2. UTF-8 canonical JSON with deterministic key order.
3. NFKC text and LF line endings.
4. Base-10 strings for all integers.
5. Lines ordered by line number.
6. Null used consistently for absent commercial options.

Internal buyer notes and database/runtime metadata are excluded. The SHA-256 digest is lowercase hexadecimal. Party snapshots, terms, totals, dates, asset metadata, or line commercial inputs change the hash.

## Index authority

`schema.ts` is authoritative. Organization-first indexes cover:

- normalized PO uniqueness;
- buyer sort time;
- buyer status and/or asset by sort time;
- buyer status and/or asset by issue date;
- supplier status/activity;
- command receipts;
- dashboard counter identity;
- organization/user notifications.

List handlers select an index matching each supported filter combination and use native Convex cursor pagination.

## Migration

The development deployment inventory found all four pre-existing skeleton tables empty. The canonical schema was applied directly and `migrations.sprint4OrderInventory` provides a bounded post-rollout inventory query.

For any non-empty deployment:

1. deploy widened optional fields and compatibility reads;
2. write only canonical new documents;
3. backfill only values derivable without business judgment;
4. keep unresolved commercial records closed to send;
5. verify counts/shapes/index readiness;
6. narrow only after unresolved count is zero.

Never infer supplier identity, totals, snapshots, terms, or asset metadata. Rollback means halting new writers and restoring the prior compatible code/schema; frozen commercial data is never rewritten.
