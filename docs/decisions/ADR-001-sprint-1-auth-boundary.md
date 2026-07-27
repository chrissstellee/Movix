# ADR-001: Sprint 1 Authentication Boundary

- **Status:** Accepted for implementation
- **Date:** 2026-07-27
- **Technical owner:** Elliot
- **Product owner:** Chris/Nicole
- **Documentation owner:** Bri

## Context

Sprint 1 must turn a visitor into a verified Movix application identity that Convex can trust, without requesting funds or granting business authorization. Wallet connection alone exposes only a public address and network. The system also needs safe returning sessions, logout, replay resistance, recoverable failures, and a protected Sprint 2 onboarding handoff.

## Decision

1. Support Stellar Testnet, Freighter through current Stellar Wallets Kit v2, and standard `G...` accounts only.
2. Use SEP-10 to prove control of the selected wallet. Challenges are domain-bound, sequence `0`, nonce-bearing, time-bounded, server-signed, stored by hash, and atomically one-time-use.
3. Keep browser authentication endpoints same-origin. Browser-callable functions cannot sign or consume challenges, mint JWTs, or create refresh sessions.
4. Issue RS256 application JWTs by default with exact issuer/audience validation, a published `kid`, short lifetime, unique `jti`, stable Movix user `sub`, verified wallet claim, and Testnet claim.
5. Use separate keys for SEP-10 signing and application JWT signing.
6. Hold access JWTs in browser memory only. Persist an opaque rotating HttpOnly session credential in a secure host-only cookie and only its hash server-side.
7. Rotate the credential on every successful refresh. Reuse of a superseded credential revokes the session family.
8. Configure Convex custom authentication and use `ConvexProviderWithAuth`. Protected functions derive identity from `ctx.auth` and map it to an active Movix user and verified wallet.
9. Treat logout as idempotent session revocation plus cookie/in-memory/Convex cleanup. Wallet disconnection remains separate.
10. Route the authenticated user to the protected `/onboarding/business` placeholder. Organization membership, buyer/supplier capability, and business authorization remain Sprint 2 work.

## Consequences

### Benefits

- Wallet connection cannot be mistaken for authenticated identity.
- A captured challenge cannot be reused to create multiple sessions.
- Short-lived JWTs limit bearer-token exposure while rotating sessions avoid repeated wallet signatures.
- Convex functions share one trusted identity boundary for Sprint 2.
- Testnet-only scope and explicit no-funds language keep the pilot claim accurate.

### Costs

- The system must operate two separate signing-key lifecycles.
- Refresh rotation requires concurrency control and reuse detection.
- Deployment origin, issuer, audience, discovery, and JWKS configuration must match exactly.
- Wallet and network changes require explicit state invalidation and fresh authentication.

## Alternatives considered

- **Wallet connection as login:** rejected because an address returned to the browser is not proof of control.
- **Long-lived JWT in local or session storage:** rejected because persistent bearer tokens increase browser compromise impact and weaken revocation.
- **Email/social authentication:** outside Sprint 1 and does not prove control of the Stellar settlement account.
- **Client-side challenge/JWT signing:** rejected because private server keys and trust decisions must remain server-side.
- **Mainnet or multiple wallets:** deferred until the P0 Testnet/Freighter path and operational controls are proven.
- **SEP-10 identity as business authorization:** rejected because wallet control does not prove organization role or purchasing/supplying authority.

## Verification

Acceptance requires the automated and manual evidence in [Sprint 1 Testing and Evidence](../auth/testing-and-evidence.md), including negative SEP-10 cases, atomic replay/concurrency, JWT claim/signature failures, rotation/reuse/logout behavior, Convex authenticated and unauthenticated smoke tests, and one controlled real-Freighter Testnet smoke.

## Change triggers

Create a superseding ADR before:

- adding Mainnet, muxed/contract accounts, or another committed wallet;
- changing SEP-10 verification or challenge persistence;
- changing JWT algorithm, issuer/audience, claims, or identity mapping;
- weakening key separation or moving private operations into browser-callable code;
- persisting bearer tokens in the browser;
- changing refresh rotation, reuse response, cookie policy, or session lifetime maximum;
- merging wallet authentication with organization/business authorization.
