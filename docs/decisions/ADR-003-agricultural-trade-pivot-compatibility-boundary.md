# ADR-003: Agricultural trade pivot compatibility boundary

**Status:** Accepted  
**Date:** July 29, 2026

## Context

After Sprint 5, Movix pivoted from generic B2B procurement to ASEAN agricultural trade. The existing order, authorization, revision, and escrow implementation is reusable. A broad technical rename or escrow redesign would add migration risk without improving settlement safety.

## Decision

- User-facing language becomes Importer, Exporter, Trade Order, Trade Agreement, Shipment Status, and Delivery Confirmation.
- Existing tables, routes, roles, modules, API functions, contract fields, and historical records remain compatible during Sprint 6.
- Agricultural terms, Shipment operations, Trade Documents, and verification live off-chain.
- Trade Order, Shipment, and Escrow remain independent state machines.
- New revisions use a versioned `order-terms-v2` commitment; v1 hashes are never recomputed.
- Soroban escrow v1 remains unchanged. Its `buyer`, `supplier`, `terms_hash`, `shipment_hash`, and `delivery_hash` fields receive agricultural meaning through an application adapter.
- Off-chain Trade Agreement acceptance remains distinct from funded-escrow activation through the contract `accept` function.
- Document bytes remain private; only deterministic evidence-manifest hashes may be committed on-chain.

## Consequences

The pivot can ship additively and preserve deployed escrows and Sprint 0–5 evidence. Code contains temporary legacy names, so documentation and adapters must keep their meaning explicit. Destructive narrowing is deferred until telemetry, reconciliation, and rollback gates pass.

## Rejected alternatives

- Global buyer/supplier/order code rename in Sprint 6.
- Storing commodity or document data directly on Soroban.
- Combining Trade Order, Shipment, and Escrow into one status enum.
- Removing the funded-escrow activation step.
- Rehashing historical revisions into the new schema.
