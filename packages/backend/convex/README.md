# Movix Convex Backend

This directory owns authenticated identity resolution, business onboarding and verification, organization membership/authorization, Trade Order and counterparty compatibility APIs, readiness, profile settings, audits, schema, and stateful migrations.

Sprint 6 keeps `buyer`, `supplier`, `orders`, and `procurement` technical identifiers where required for compatibility. New public documentation uses Importer, Exporter, Trade Order, and Agricultural Trade. Thin canonical aliases must delegate to the existing authorization and mutation logic rather than duplicate it.

## Boundaries

- Public functions derive users from `ctx.auth`; clients never submit user identity.
- Organization reads/writes require an active membership in the exact organization.
- Multiple active memberships are explicit and unsupported.
- Draft and profile writes use `v.int64()`/`bigint` optimistic versions.
- Completion is atomic and idempotent.
- Audits contain changed field names, not raw values.

The web app imports generated public references through `@repo/backend/client`.

## Development

```bash
pnpm --filter @repo/backend dev
pnpm --filter @repo/backend typecheck
pnpm --filter @repo/backend lint
pnpm --filter @repo/backend test
pnpm --filter @repo/backend build
```

## Migration workflow

Inventory the selected deployment before mutation. With records present, widen first, dry-run and execute each resumable migration, reconcile counts, and keep compatibility readers. Do not narrow agricultural-pivot fields or remove legacy APIs in Sprint 6.

```bash
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:normalizeLegacyOrganizations","dryRun":true}'
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:normalizeLegacyOrganizations"}'
```

Then run memberships, contacts, and addresses in that order. Add `--prod` only through an approved production change. Never export live documents for evidence.

See [data and validation](../../../docs/business-onboarding/data-and-validation.md), [architecture](../../../docs/business-onboarding/architecture.md), and the [security/operations runbook](../../../docs/business-onboarding/security-operations-runbook.md).

The agricultural compatibility boundary and `legacy_incomplete` migration rules are documented in [Agricultural Trade Architecture and Sprint 6 Migration](../../../docs/agricultural-trade-architecture-and-migration.md).
