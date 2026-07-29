# Movix Web

The Next.js application owns the public landing/login experience, business onboarding, organization-aware Importer/Exporter trade workspace, Trade Order views, business settings, and auth-only wallet settings.

Visible Sprint 6 terminology is agricultural trade. The current `/buyer`, `/supplier`, and `/orders` route paths remain compatibility identifiers and must not determine backend authorization.

## Routes

| Route | Access |
|---|---|
| `/` and `/login` | Public |
| `/onboarding/business` | Authenticated user with no active organization |
| `/buyer` | Active Importer-capable membership; legacy route retained during compatibility |
| `/supplier` | Active Exporter-capable membership; legacy route retained during compatibility |
| `/orders`, `/orders/new`, `/orders/[orderId]` | Authorized Trade Order list, creation, and role-aware detail |
| `/settings/business` | Active organization membership with server-authorized edits |
| `/settings/wallet` | Authenticated user |

Routes consume the typed Convex API from `@repo/backend/client`. UI route policy is only a navigation aid; Convex independently authorizes every read and write.

## Development and gates

From the repository root:

```bash
pnpm --filter web dev
pnpm --filter web format:check
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web test:a11y
pnpm --filter web build
```

The app expects the approved local authentication environment and a dedicated Convex development deployment. Do not use production data for fixtures or browser journeys.

See the [Sprint 2 implementation runbook](../../docs/business-onboarding/implementation-runbook.md), [API contract](../../docs/business-onboarding/api-contract.md), and [testing/evidence matrix](../../docs/business-onboarding/testing-and-evidence.md).

Current product and UI rules are in the [agricultural trade pivot](../../docs/Movix-ASEAN-Agricultural-Trade-Pivot.md) and [Sprint 6 architecture/migration guide](../../docs/agricultural-trade-architecture-and-migration.md).
