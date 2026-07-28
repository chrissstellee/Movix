# Buyer procurement security and operations

Status: Sprint 4 operating contract  
Scope authority: [Sprint 4 detailed specification](../Movix-Sprint-04-Buyer-Procurement-Detailed.md)

## Tenant isolation

Public order APIs derive one active organization from the authenticated Convex identity. They never accept a buyer organization ID. Reads and child mutations first authorize the parent order; foreign and unknown IDs share the safe `ORDER_NOT_FOUND` response. Owner/admin/procurement may draft; send additionally requires `order:send`. Suspended users, memberships, wallets, or organizations fail closed.

Supplier resolution accepts an exact verified Testnet wallet or existing relationship ID. Do not add fuzzy name search, autocomplete across tenants, result counts, or distinct “exists but forbidden” errors.

## Sensitive data

Do not log, document, screenshot, or attach:

- complete wallets or auth identities;
- contact email/phone and full addresses;
- PO line descriptions, prices, totals, notes, or canonical payloads;
- secrets, tokens, issuer keys, or raw session data.

Use fictional names and truncated identifiers. Audit events store action names and changed field names, not values. Supplier notifications contain an organization ID, event metadata, entity ID, and internal action route only.

## Recovery

### Stale draft

Stop autosave after `ORDER_STALE`. Keep the user-visible stale state, discard no server data, and offer reload latest. Do not retry with a guessed version or silently overwrite.

### Idempotent command

Retry create/send/cancel with the same key and identical request. `IDEMPOTENCY_CONFLICT` requires operator/developer investigation; never mint a new key merely to force a duplicate side effect.

### Migration incident

1. Stop canonical writers for the affected deployment.
2. Run bounded inventory and capture redacted counts/shapes.
3. Do not narrow schema or activate dependent behavior.
4. Classify failures as derivable versus unresolved.
5. Resume a migration from its component cursor only after correction.
6. If rollback is required, deploy the last compatible widened reader/writer. Never delete or rewrite frozen revisions.

### Notification or audit incident

Disable the consumer/delivery path, not the authoritative order transaction. Preserve receipts and frozen data. Identify by correlation/idempotency key and organization, avoid copying payloads into tickets, and regenerate only delivery side effects after proving uniqueness.

## Security incident procedure

1. Contain the affected deployment/function or consumer.
2. Preserve redacted logs, command key, entity ID, timestamps, and deployment version.
3. Determine whether authorization, confidentiality, integrity, or availability was affected.
4. Query by organization-first indexes; do not export broad tables.
5. Invalidate sessions/credentials if identity exposure is suspected.
6. Correct code and add a regression test before replaying commands.
7. Notify product/security owners using the project incident channel.
8. Record the release decision and sanitized evidence manifest entry.

## Release checklist

- Every target deployment inventoried independently.
- No unresolved commercial legacy rows.
- Auth/foreign/suspended/self-dealing tests green.
- Duplicate send/cancel produces one receipt and side-effect set.
- Logs, errors, notifications, audits, screenshots, and traces pass redaction review.
- Contract/Stellar regression is green and shows no Sprint 4 escrow invocation.
- QA and product sign-offs are linked from the evidence manifest.
