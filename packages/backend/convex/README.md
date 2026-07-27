# Movix Convex Backend

This directory owns authenticated identity resolution, business onboarding, organization membership/authorization, readiness, profile settings, wallet settings, audits, schema, and stateful migrations.

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

Inventory the selected deployment before mutation. With records present, keep the widened schema, dry-run and execute each resumable migration, verify, then narrow.

```bash
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:normalizeLegacyOrganizations","dryRun":true}'
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:normalizeLegacyOrganizations"}'
```

Then run memberships, contacts, and addresses in that order. Add `--prod` only through an approved production change. Never export live documents for evidence.

See [data and validation](../../../docs/business-onboarding/data-and-validation.md), [architecture](../../../docs/business-onboarding/architecture.md), and the [security/operations runbook](../../../docs/business-onboarding/security-operations-runbook.md).
