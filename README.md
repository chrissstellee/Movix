# Movix

Movix is a Testnet procurement pilot that uses Stellar for wallet-based authentication and traceable escrow settlement. Sprint 1 provides the secure wallet sign-in boundary, Sprint 2 adds tenant-safe business onboarding, and Sprint 3 defines the immutable escrow contract v1 lifecycle and release proof.

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
| `packages/stellar`        | Testnet configuration, wallet boundaries, and generated escrow integration      |
| `packages/ui`             | Shared accessible UI primitives                                                 |
| `packages/domain`         | Shared domain types and fixtures                                                |
| `contracts`               | Stellar escrow contract, lifecycle, invariants, and native tests                |
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
pnpm contracts:bindings
```

Local and testnet contract scripts are dry-run-safe by default. Read the Sprint 3 deployment runbook before adding `--execute`; never put a secret directly in a package command.

The inherited baseline and Sprint 1 rules are recorded in [authentication testing and evidence](docs/auth/testing-and-evidence.md). Sprint 2 criteria are recorded in [business-onboarding testing and evidence](docs/business-onboarding/testing-and-evidence.md). Sprint 3 verification status is recorded in the [escrow testing and evidence guide](docs/contracts/escrow-v1/testing-and-evidence.md).

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

## Sprint 3 escrow contract

### Stellar testnet deployment

The following contracts are testnet-only and have no production monetary
value.

| Contract        | Contract ID                                                | Stellar Expert                                                                                                             |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Movix Escrow v1 | `CAAU4AY6UBXVYGCWWXQ5KOAYEFWG7IPTNSACBLEMII3XX4HYD4C6KMIS` | [View contract](https://stellar.expert/explorer/testnet/contract/CAAU4AY6UBXVYGCWWXQ5KOAYEFWG7IPTNSACBLEMII3XX4HYD4C6KMIS) |
| Native XLM SAC  | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [View contract](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |
| USDC SAC        | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | [View contract](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |

Deployment transaction:
[ledger 3,839,808](https://stellar.expert/explorer/testnet/tx/83290e28fba0d7a25891000625fb3a3a357910123a3339ce849ee88b9f9ff907).
The deployed WASM was fetched back from testnet and matched the verified
19,617-byte artifact with SHA-256
`a6c938a6148a7fd0cc768eee25088ef66822243c05e71516e1400d9bc18bd498`.

- [Detailed Sprint 3 specification](docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md)
- [Frozen contract ABI](docs/contracts/escrow-v1/abi.md)
- [Threat model](docs/contracts/escrow-v1/threat-model.md)
- [Errors and events](docs/contracts/escrow-v1/errors-and-events.md)
- [Deployment runbook](docs/contracts/escrow-v1/deployment-runbook.md)
- [Testing and evidence](docs/contracts/escrow-v1/testing-and-evidence.md)
- [Testnet deployment manifest](deployments/stellar/testnet/escrow-v1.json)
- [Sprint 3 evidence index](docs/evidence/sprint-03/README.md)
