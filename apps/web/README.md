# Movix Web

The Next.js application owns the public landing/login experience, the five-step business onboarding flow, organization-aware buyer/supplier shell, business settings, and auth-only wallet settings.

## Routes

| Route | Access |
|---|---|
| `/` and `/login` | Public |
| `/onboarding/business` | Authenticated user with no active organization |
| `/buyer` | Active buyer-capable membership |
| `/supplier` | Active supplier-capable membership |
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
