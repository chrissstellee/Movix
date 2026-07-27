# Movix

Movix is a Testnet procurement pilot that uses Stellar for wallet-based authentication and, in later sprints, traceable escrow settlement. Sprint 1 provides the secure wallet sign-in boundary. Sprint 2 adds resumable business onboarding, atomic organization/owner creation, tenant-isolated buyer and supplier workspaces, and concurrency-safe business settings.

> [!IMPORTANT]
> Movix currently supports Stellar Testnet only. Testnet assets have no production monetary value. Connecting or signing in with a wallet does not transfer funds and does not authorize a business to buy or supply.

## Prerequisites

- Node.js `>=20.9`
- pnpm `10.1.0`
- Rust and the `wasm32v1-none` target for contract checks
- A Convex development deployment
- Freighter configured for Stellar Testnet for the manual authentication smoke test
- Server secrets supplied through the approved local or deployment secret store

Never commit wallet secrets, private signing keys, session credentials, JWTs, or raw/signed authentication transactions.

## Local setup

1. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Generate development-only authentication keys and synchronize the public/shared
   values with your selected Convex development deployment:

   ```bash
   pnpm auth:setup:local
   ```

   This command preserves the existing Convex URLs in `apps/web/.env.local`, writes
   uncommitted local keys, and does not change any external deployment.

3. Synchronize the issuer/audience, auth-store bearer secret, and public JWT
   verification material with the Convex development deployment selected by
   `packages/backend/.env.local`:

   ```bash
   pnpm auth:setup:convex
   ```

   This command changes the selected external development deployment. It does not
   upload the SEP-10 signing secret or RSA private key. See
   [Sprint 1 authentication configuration](docs/auth/configuration.md) for production
   provisioning.

4. Start the Convex backend:

   ```bash
   pnpm --filter @repo/backend dev
   ```

5. In another terminal, start the web app:

   ```bash
   pnpm --filter web dev
   ```

6. Open `http://localhost:3000`.

PowerShell environments that block `pnpm.ps1` can invoke the same commands with `pnpm.cmd`.

## Repository map

| Path                      | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `apps/web`                | Next.js public/login pages, onboarding, organization shell, and settings        |
| `packages/backend/convex` | Convex auth, onboarding, tenant authorization, settings, schema, and migrations |
| `packages/stellar`        | Testnet configuration and wallet/SEP-10 boundaries                              |
| `packages/ui`             | Shared accessible UI primitives                                                 |
| `packages/domain`         | Shared domain types and fixtures                                                |
| `contracts`               | Soroban escrow contract work retained as a quality gate                         |
| `e2e`                     | Playwright journeys and deterministic wallet/auth fixtures                      |
| `docs`                    | Sprint plans, architecture, decisions, operations, and review evidence          |

## Quality gates

Run the complete Sprint 1 closure suite from the repository root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:a11y
pnpm test:e2e
pnpm build
pnpm test:contracts
pnpm build:contracts
```

The current inherited baseline and Sprint 1 rules are recorded in [authentication testing and evidence](docs/auth/testing-and-evidence.md). Sprint 2 criteria and remaining release evidence are recorded in [business-onboarding testing and evidence](docs/business-onboarding/testing-and-evidence.md).

## Sprint 1 documentation

- [Sprint 1 detailed specification](docs/Movix-Sprint-01-Landing-SEP10-Detailed.md)
- [Authentication architecture](docs/auth/architecture.md)
- [Authentication API contract](docs/auth/api-contract.md)
- [Environment and secret configuration](docs/auth/configuration.md)
- [Security and operations runbook](docs/auth/security-operations-runbook.md)
- [Testing and evidence checklist](docs/auth/testing-and-evidence.md)
- [Authentication-boundary ADR](docs/decisions/ADR-001-sprint-1-auth-boundary.md)
- [Sprint 1 evidence manifest](docs/evidence/sprint-01/README.md)

## Contribution rules for authentication

- Wallet connection is not authentication.
- SEP-10 proves control of a wallet; it does not grant organization or business authorization.
- Browser-callable code must not mint JWTs, sign or consume challenges, or create refresh sessions.
- Access JWTs remain in memory. The browser persists only an opaque rotating HttpOnly session cookie.
- Protected Convex functions derive identity from `ctx.auth`; they never trust a client-supplied user identifier.
- Update the relevant contract, runbook, evidence matrix, and ADR in the same change whenever auth behavior changes.

## Sprint 2 business onboarding

- [Detailed Sprint 2 specification](docs/Movix-Sprint-02-Business-Onboarding-Detailed.md)
- [Implementation runbook](docs/business-onboarding/implementation-runbook.md)
- [Architecture](docs/business-onboarding/architecture.md)
- [API contract](docs/business-onboarding/api-contract.md)
- [Data and validation](docs/business-onboarding/data-and-validation.md)
- [Security and operations](docs/business-onboarding/security-operations-runbook.md)
- [Testing and evidence](docs/business-onboarding/testing-and-evidence.md)
- [Organization authorization ADR](docs/decisions/ADR-002-sprint-2-organization-authorization-boundary.md)
- [Sprint 2 evidence manifest](docs/evidence/sprint-02/README.md)

Organization context is server-derived. Do not trust client-selected organization, membership, role, status, capability, or document version values.
