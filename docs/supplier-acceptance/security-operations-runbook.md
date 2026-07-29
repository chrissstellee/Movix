# Supplier Acceptance Security and Operations Runbook

## Isolation checks

- Confirm the active principal has a valid session family, active user, Testnet wallet, sole active membership, and active organization.
- Supplier reads require a supplier-capable verified organization and exact `orders.supplierOrganizationId`.
- Decision writes additionally require `order:decide`.
- Treat unknown and foreign IDs identically as `ORDER_NOT_FOUND`.
- A paused buyer/supplier relationship does not erase existing obligations; authorization still relies on the frozen supplier binding and active verified organization.

## Redaction checks

Search decision receipts, notifications, audits, supplier lists, and application logs for rejection-note canaries. Plaintext notes may exist only in the authorized immutable decision record/detail. Receipts contain only a SHA-256 fingerprint. Audits list changed field names, not values.

Never log function arguments for accept/reject. Never include buyer internal notes, session identifiers, user IDs, or live organization fields in supplier responses.

## Race recovery

Convex serializes mutations. When accept/reject/cancel/revision/expiry race:

1. Inspect the canonical order, current revision, current decision, receipt(s), notification, audit, and count row.
2. One terminal revision decision is valid; zero may be valid if cancel/expiry won.
3. Do not insert compensating commercial decisions manually.
4. If projections differ from canonical state, disable affected UI counts and repair projections only.
5. Preserve all receipts/audits for investigation.

## Count drift

Run `migrations:reconcileSupplierOrderCounts` per supplier. If `exact` is false, use paginated operational tooling rather than trusting the 10,000-row safety bound. If `matches` is false:

1. Disable supplier attention counts.
2. Snapshot canonical orders and the count row.
3. Identify the first incorrect transition from send/decision/cancel/revision/expiry audits.
4. Rebuild only the projection under an approved migration.
5. Re-run reconciliation before restoring the UI.

## Migration incident

Any `SPRINT5_MIGRATION_ABORT_*` error is a hard stop. Preserve the order ID and deployment snapshot. Investigate missing revision/decision identity from authoritative records. Never synthesize a historical actor, wallet, hash, or decision time.

Rollback keeps additive fields/tables. Disable feature exposure and restore the prior application version. Decision records are append-only history and must not be deleted.

## Suspected data exposure

1. Disable supplier detail/decision routes.
2. Revoke affected sessions if identity data may be exposed.
3. Preserve logs and evidence with restricted access.
4. Determine whether the leak crossed organization boundaries.
5. Patch the backend validator/mapper first; a React-only hide is insufficient.
6. Add a denylist regression test and obtain Security sign-off before reactivation.
