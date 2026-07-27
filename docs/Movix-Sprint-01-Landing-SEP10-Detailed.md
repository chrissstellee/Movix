# Movix Sprint 1 — Detailed Landing and SEP-10 Authentication Plan

**Sprint:** 1  
**Theme:** Acquisition, wallet connection, and secure authentication  
**Default duration:** 10 business days  
**Delivery target:** Visitor-to-authenticated-user vertical slice on Stellar Testnet  
**Primary implementer:** Elliot  
**Prepared:** July 27, 2026  
**Source sprint plan:** [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)  
**Source implementation plan:** [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)  
**Foundation plan:** [Movix Sprint 0 — Detailed Foundation Plan](./Movix-Sprint-00-Foundation-Detailed.md)

## 1. Sprint purpose

Sprint 1 proves that a person can understand Movix, connect a supported Stellar wallet, prove control of the selected account through SEP-10, obtain a Movix application session, use that session with Convex, log out, and safely recover from common failures.

This is one vertical product slice, not two unrelated deliverables:

1. The landing page creates enough trust and understanding for the visitor to continue.
2. The login flow turns the visitor into a verified application identity without requesting or moving funds.
3. The resulting identity is accepted by Convex and can reach the Sprint 2 onboarding boundary.

The sprint does not prove that a business is authorized to buy or supply. SEP-10 proves wallet control only. Organization creation, membership, roles, and business authorization begin in Sprint 2.

## 2. Capacity assumption

The 10-day schedule assumes at least:

- One Web/Product/Design workstream.
- One Backend/Stellar/Auth workstream.
- QA coverage throughout the sprint.

If Elliot is the only implementer across all workstreams, plan approximately 15–20 focused engineering days. Preserve the P0 scope and move P1 analytics before weakening SEP-10 validation, replay protection, session revocation, Convex identity verification, recovery states, or automated tests.

## 3. Current repository baseline

Observed at Sprint 1 planning:

| Area | Present | Sprint 1 gap |
|---|---|---|
| Runtime and CI | Node `>=20.9`, pnpm, Turbo, unit, accessibility, Playwright, typecheck, build, and Rust gates | Add authentication-specific coverage and required environment values |
| Web app | Next.js 16/React 19, shared Convex provider, Movix tokens, foundation page | `/` is still a foundation placeholder; `/login` and protected handoff do not exist |
| Shared UI | Button, Card, Badge, Accordion, Alert, Dialog, Tooltip, Spinner, Skeleton, Sonner, and other primitives | Compose landing/login features without creating duplicate primitives |
| Stellar package | Testnet config, Wallet/SEP-10 interfaces, exact amounts, and package boundary | No Wallets Kit dependency, concrete wallet adapter, challenge builder, or verifier |
| Convex | Domain schema skeleton with `users` and `wallets` | No challenge/session records, auth functions, `auth.config.ts`, or authenticated identity mapping |
| Session client | Plain `ConvexProvider` | No custom auth adapter or `ConvexProviderWithAuth` integration |
| End-to-end tests | Foundation smoke test | No wallet/auth mocks or login journeys |
| Environment sample | Convex URL and foundation switch | No home domain, web-auth domain, JWT, JWKS, cookie, or SEP-10 key declarations |

This baseline means Sprint 1 is feature implementation, not foundation scaffolding. Elliot should extend the existing package boundaries instead of moving auth logic into page components.

## 4. Sprint goal

> A visitor with Freighter can understand Movix, connect on Stellar Testnet, sign a valid SEP-10 challenge that clearly does not authorize payment, receive a Convex-compatible Movix session, reach the protected onboarding boundary, log out, and repeat the journey without stale or replayable state.

## 5. Sprint demo

The Sprint 1 review must show one continuous journey:

1. Open `/` at desktop and 320px widths.
2. Explain Movix from the page without presenter narration.
3. Follow the primary CTA to `/login`.
4. Open the Wallets Kit selection experience.
5. Connect Freighter on Testnet.
6. Show the connected network and wallet address.
7. Explain that signing in does not transfer funds.
8. Request and sign one SEP-10 challenge.
9. Show successful Convex authentication.
10. Reach `/onboarding/business`, which is a protected Sprint 2 handoff placeholder.
11. Log out.
12. Show that protected Convex access is lost.
13. Reconnect successfully.
14. Demonstrate at least one recovery case, preferably rejected signature or expired challenge.
15. Demonstrate that replaying the previously signed XDR is rejected.

The demo is incomplete if it only shows a connected wallet. Wallet connection and authenticated application identity are distinct states.

## 6. Product and technical decisions fixed for Sprint 1

Elliot may improve implementation details without changing these behavior contracts.

| Decision | Sprint 1 rule |
|---|---|
| Network | Stellar Testnet only |
| Committed wallet | Freighter through Stellar Wallets Kit |
| Additional wallets | P1 or Stretch only after the Freighter P0 path is secure |
| Account type | Standard Stellar `G...` account only; muxed and contract accounts are out of scope |
| Wallet meaning | Connection exposes a public address/network; it does not create a Movix session |
| Authentication | SEP-10 challenge and signed-response verification |
| Business authorization | Explicitly not granted in Sprint 1 |
| First authenticated destination | `/onboarding/business` protected placeholder |
| App identity | One stable Movix user per verified primary wallet on Testnet |
| Convex subject | Stable internal Movix user ID; wallet/network may be additional JWT claims |
| JWT algorithm | RS256 by default; ES256 is acceptable only if configuration and tests change together |
| JWT validation | `iss`, `aud`, `sub`, `exp`, `iat`, `kid`, `alg`, and `typ` are required and verified as applicable |
| Challenge lifetime | Five minutes by default and server-configurable |
| Access JWT lifetime | Ten minutes by default and server-configurable |
| Refresh session lifetime | Seven days maximum for the pilot, rotating on refresh |
| Browser persistence | Opaque rotating session cookie only; no long-lived token in local storage |
| Replay protection | A challenge is one-time-use and consumed atomically |
| Key separation | SEP-10 Stellar signing key and application JWT signing key must be different |
| Data handling | Never log raw/signed XDR, raw access/refresh tokens, wallet secrets, or private signing keys |
| UI promise | “Signing in does not transfer funds.” |
| Mainnet | Not selectable, not implied, and visibly out of scope |

If a fixed decision must change, Elliot should stop that work item and record a decision with Product and the relevant technical owner. Do not silently widen wallet, network, account, or session scope.

## 7. User journeys

### 7.1 First successful visit

1. Visitor opens `/`.
2. Visitor understands the buyer and supplier protection model.
3. Visitor sees that the product is a Testnet pilot supporting Testnet XLM and the allowlisted Testnet USDC path.
4. Visitor activates the primary login CTA.
5. `/login` presents wallet connection as step 1 and authentication as step 2.
6. Visitor chooses Freighter.
7. Movix reads the selected `G...` address and wallet network.
8. If the network is Testnet, Movix displays the address and enables authentication.
9. Movix requests one challenge.
10. The user sees the no-funds message and asks Freighter to sign.
11. The server validates and consumes the challenge.
12. Movix creates or finds the user, creates a refresh session, and returns an application access JWT.
13. The Convex client authenticates with the access JWT.
14. The user enters `/onboarding/business`.

### 7.2 Returning session

1. User revisits Movix with a valid session cookie.
2. The client requests a fresh access JWT.
3. Convex authenticates without requesting another wallet signature.
4. The user reaches the protected handoff.
5. If the session is expired or revoked, the user returns to `/login` with a non-alarming explanation.

### 7.3 Logout

1. User activates logout.
2. The server revokes the current session and clears the cookie.
3. The client clears its in-memory access token and Convex authentication.
4. Protected access fails.
5. Wallet disconnection is attempted as a separate cleanup action; authentication logout must still succeed if wallet disconnection fails.

### 7.4 Wallet or network changes

1. Wallet Kit reports an address or network change.
2. Movix invalidates the pending challenge and local authenticated state.
3. If an application session exists for a different wallet/network, Movix logs out that session.
4. Testnet with a supported `G...` account may begin a fresh SEP-10 flow.
5. Any other network remains blocked with clear Testnet recovery guidance.

## 8. Scope

### 8.1 P0 committed scope

- Production landing page at `/`.
- Production login page at `/login`.
- Accessible public navigation, content sections, CTA, FAQ, and footer.
- Freighter connection through the current Wallets Kit v2 API.
- Testnet address/network validation.
- SEP-10 challenge generation and signed challenge verification.
- One-time challenge persistence and replay rejection.
- Stable user/wallet identity mapping.
- Application JWT issuance and public JWKS.
- Convex custom JWT configuration and authenticated provider integration.
- Rotating session cookie, access-token refresh, logout, and revocation.
- Protected `/onboarding/business` handoff placeholder.
- Canonical login recovery states.
- Unit, component, backend/integration, accessibility, and Playwright tests.
- Privacy-safe operational events and logs needed to diagnose the login funnel.

### 8.2 P1 scope

- Product analytics persistence/dashboard beyond structured operational events.
- A second explicitly approved Wallets Kit module.
- Polished but non-essential motion that respects reduced-motion preferences.
- Key-rotation rehearsal using a second test key.

### 8.3 Explicitly out of scope

- Business onboarding fields or completed application shell.
- Organization creation, membership, buyer/supplier role authorization, or role switching.
- Wallet balance display, asset trustline creation, payments, Soroban calls, or transaction submission.
- Mainnet or runtime network switching.
- Email/password, social login, passkeys, or custodial accounts.
- Muxed accounts, contract accounts, hardware-wallet-specific flows, and multisig UX.
- Full terms/privacy policy authoring.
- Remembering wallet secrets or requesting a secret key.
- Broad admin session management.

## 9. Landing-page content contract

Product may tune words during implementation, but every section must preserve the following claims and boundaries.

### 9.1 Header

- Movix wordmark.
- Anchor links that match real page sections.
- Primary “Connect wallet” or “Sign in” CTA to `/login`.
- Mobile navigation remains keyboard-operable and closes predictably.

### 9.2 Hero

- Recommended headline: “Procurement that settles with certainty.”
- State the core promise: buyers commit agreed funds before fulfillment; suppliers receive payment after buyer-confirmed delivery.
- Name both buyer and supplier value.
- Show a visible “Testnet pilot” badge.
- Primary CTA goes to `/login`.
- Optional secondary CTA scrolls to “How it works.”

### 9.3 How Movix works

Use four plain-language stages:

1. Agree on a complete purchase order.
2. Lock the exact accepted value in Stellar escrow.
3. Record fulfillment and review delivery.
4. Release or mutually refund with a traceable record.

Do not say the blockchain independently proves shipment or physical delivery.

### 9.4 Trust and security explanation

Explain:

- Wallet-based authentication proves control of an address.
- Signing in does not transfer funds.
- Funds move only in later, explicit transaction-review flows.
- Commercial details remain off-chain; settlement evidence is traceable on Stellar.
- Movix is Testnet-only during the pilot.

Do not claim:

- Guaranteed delivery.
- Automatic dispute resolution.
- Audited or risk-free contracts unless that statement becomes fact.
- Mainnet readiness.
- Custody of user private keys.

### 9.5 Supported network and assets

Disclose:

- Stellar Testnet.
- Testnet XLM.
- The single allowlisted Testnet USDC configuration used by the project.
- Assets have no production monetary value in this pilot context.

This section is informational. It must not trigger a wallet transaction or balance lookup.

### 9.6 FAQ

Minimum questions:

- What does Movix protect?
- Does signing in move funds?
- Does Movix hold my private key?
- Does Stellar prove that goods were delivered?
- Which network and assets are supported?
- What happens if the buyer and supplier want a refund?
- Is Movix ready for Mainnet?

### 9.7 Footer

- Movix identity.
- Testnet-pilot disclosure.
- Working support/contact link if one is provided.
- Only valid legal links. Omit unavailable legal destinations instead of shipping dead links.

## 10. Login interaction contract

### 10.1 Layout

- Page heading clearly says “Sign in to Movix.”
- Two visible stages: “1. Connect wallet” and “2. Verify ownership.”
- Explain why a wallet signature is requested before prompting the wallet.
- Link back to the landing page.
- Keep Testnet status visible.

### 10.2 Connected-wallet display

After connection show:

- Wallet name.
- Network.
- Truncated address in normal display.
- Copy control for the full address.
- View/full-value control or accessible full value.
- “Change wallet” action.
- “Disconnect” action.

The full address must be available to assistive technology without forcing it into every visual layout.

### 10.3 Authentication action

The primary action:

- Says “Verify wallet” or “Sign in.”
- Is disabled until a supported Testnet account is connected.
- Shows “Signing in does not transfer funds.”
- Allows only one active request.
- Shows progress for challenge request, wallet signature, server verification, and session creation.
- Never changes to payment language.

### 10.4 Success

- Announce success in an accessible status region.
- Wait until the Convex client confirms authentication.
- Navigate to `/onboarding/business`.
- Do not display a success state based only on receiving a wallet signature.

### 10.5 Error and retry

Every recoverable error must:

- Preserve only safe state.
- Explain what happened in user language.
- Provide one clear next action.
- Avoid exposing raw server, XDR, token, or stack-trace details.
- Retain the connected wallet only when it is still safe and accurate.

## 11. Canonical login state machine

Use one explicit orchestration state rather than several unrelated booleans.

| State | User sees | Allowed actions | Exit |
|---|---|---|---|
| `idle` | Wallet selection prompt | Connect | `connecting` |
| `connecting` | Wallet UI pending | Cancel in wallet | `connected`, `wallet_unavailable`, or `connection_rejected` |
| `connected` | Wallet, address, Testnet | Verify, change, disconnect | `requesting_challenge`, `wrong_network`, or `idle` |
| `wrong_network` | Required Testnet guidance | Retry network check, change wallet | `connected` or `idle` |
| `requesting_challenge` | Preparing secure sign-in | No duplicate submit | `awaiting_signature` or `challenge_error` |
| `awaiting_signature` | Wallet signature pending and no-funds copy | Reject in wallet | `verifying`, `signature_rejected`, or `wallet_changed` |
| `verifying` | Verifying wallet ownership | No duplicate submit | `establishing_session` or `verification_error` |
| `establishing_session` | Securing application session | No duplicate submit | `authenticated` or `session_error` |
| `authenticated` | Success then redirect | Continue | Protected handoff |
| `expired_challenge` | Challenge expired safely | Retry | `requesting_challenge` |
| `session_expired` | Session ended | Sign in again | `connected` or `idle` |
| `recoverable_error` | Categorized message | Retry/change wallet | Appropriate prior safe state |

Rules:

- Only one challenge may be active per wallet/session intent.
- A retry after signature rejection requests a fresh challenge.
- Any account or network change discards the pending challenge.
- Refreshing the page never restores raw challenge XDR from browser persistence.
- Authenticated state comes from the server/Convex provider, not Wallets Kit memory.

## 12. Error catalog and required behavior

| Code | User message intent | State retained | Primary recovery |
|---|---|---|---|
| `wallet_unavailable` | Freighter is unavailable in this browser | None | Install/open Freighter, then retry |
| `connection_rejected` | Wallet access was not approved | None | Try again |
| `wrong_network` | Movix pilot requires Stellar Testnet | Address may remain visible | Switch wallet to Testnet and recheck |
| `unsupported_account` | This pilot supports standard Stellar accounts | Wallet connection | Choose a supported account |
| `challenge_rate_limited` | Too many requests; wait briefly | Wallet connection | Retry after server-provided delay |
| `challenge_expired` | The sign-in request expired | Wallet connection | Create a new challenge |
| `signature_rejected` | Signature request was cancelled | Wallet connection | Try again |
| `wallet_changed` | Wallet or network changed during sign-in | New connection state only | Start fresh |
| `challenge_invalid` | Sign-in request could not be verified | Wallet connection | Start fresh; log categorized server event |
| `challenge_replayed` | Sign-in request was already used | Wallet connection | Start fresh; log security event |
| `session_failed` | Wallet verified but session could not be created | No authenticated state | Retry with fresh challenge |
| `session_expired` | Session ended safely | Optional current wallet connection | Sign in again |
| `service_unavailable` | Authentication is temporarily unavailable | Wallet connection | Retry without rapid loop |

Exact copy belongs with the feature and must be reviewed for clarity. Error categories must remain stable for tests and analytics.

## 13. Server API contract

All authentication endpoints are same-origin from the browser. Implementation may delegate to Convex HTTP actions or another server-only adapter, but no browser-callable function may mint JWTs, sign SEP-10 challenges, consume challenges, or create refresh sessions.

### 13.1 `GET /.well-known/stellar.toml`

Purpose:

- Advertise the Movix SEP-10 signing public key.
- Advertise the web authentication endpoint.

Required behavior:

- Return valid TOML.
- `SIGNING_KEY` matches the server SEP-10 key.
- `WEB_AUTH_ENDPOINT` uses the deployed Movix origin.
- No secret is present.
- Production-like deployments use HTTPS.

### 13.2 `GET /.well-known/jwks.json`

Purpose:

- Publish application JWT verification keys for Convex.

Required response:

- Valid JWKS with public key material only.
- Current `kid`, `kty`, `alg`, and `use: "sig"`.
- Cache headers that allow key rotation without a long stale window.
- During rotation, retain the retiring public key until every token it signed is expired.

### 13.3 `GET /api/auth/stellar/challenge`

Query:

```text
account=G...
```

Successful response:

```json
{
  "transaction": "<base64 XDR>",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "expiresAt": 1780000000000
}
```

Required behavior:

- Validate a standard `G...` account before building XDR.
- Use Testnet, configured home domain, configured web-auth domain, sequence `0`, and five-minute time bounds.
- Sign with the SEP-10 Stellar authentication key.
- Generate a unique challenge nonce.
- Store only the required restricted verification record and challenge hash.
- Invalidate or supersede a prior active challenge for the same login intent.
- Apply IP/account rate limits without leaking account existence.
- Return `Cache-Control: no-store`.

### 13.4 `POST /api/auth/stellar/token`

Body:

```json
{
  "transaction": "<signed base64 XDR>"
}
```

Successful response:

```json
{
  "accessToken": "<short-lived JWT>",
  "expiresAt": 1780000000000,
  "user": {
    "id": "<stable Movix user id>",
    "walletAddress": "G...",
    "network": "testnet"
  }
}
```

Required behavior:

- Limit request size and accept JSON only.
- Parse and validate the XDR with the current Stellar SDK/SEP-10 helpers where available.
- Validate sequence, source account, Testnet passphrase, home domain, web-auth domain, time bounds, operation set/order, server signature, client signature, and required threshold.
- Reject unsupported or unexpected operations and signers.
- Look up the stored challenge hash.
- Atomically mark it consumed before returning success.
- Reject expired, missing, already-used, or mismatched challenges.
- Create or find the stable `users` and `wallets` records only after successful verification.
- Create a new refresh session with an opaque random credential stored only as a secure cookie; persist only its hash.
- Mint the short-lived Convex-compatible access JWT.
- Return `Cache-Control: no-store`.
- Use a generic client response for authentication failures while preserving a safe categorized server event.

### 13.5 `POST /api/auth/token`

Successful response:

```json
{
  "accessToken": "<new short-lived JWT>",
  "expiresAt": 1780000000000
}
```

Required behavior:

- Read the HttpOnly cookie.
- Validate session hash, expiry, revocation, and rotation chain.
- Serialize refreshes for one browser session so concurrent access-token requests share one in-flight refresh.
- Rotate the opaque session credential on every successful refresh.
- Detect reuse of a superseded credential and revoke the affected session family.
- Mint a new access JWT with a new `jti` and current `kid`.
- Enforce same-origin request checks.
- Return `401` without revealing internal detail for missing/expired/revoked sessions.

### 13.6 `POST /api/auth/logout`

Required behavior:

- Revoke the current session idempotently.
- Clear the cookie even if the persisted session is already missing.
- Enforce same-origin request checks.
- Return success for repeated logout calls.

## 14. SEP-10 verification checklist

Elliot should use maintained Stellar SDK helpers where practical and add Movix-specific checks around them. Do not implement signature or XDR parsing from scratch.

The server must reject:

- Malformed or non-transaction XDR.
- A transaction for any network other than Testnet.
- A non-zero challenge sequence.
- Wrong transaction source.
- Wrong requested/client account.
- Wrong home domain.
- Wrong web-auth domain.
- Missing `web_auth_domain` operation when required by the current SEP.
- Expired or not-yet-valid time bounds.
- Missing server signature.
- Invalid server signature.
- Missing client signature.
- A client signature that does not satisfy the account threshold.
- An unexpected operation, extra operation, or altered operation order.
- A signature from the wrong account.
- A challenge hash not issued by Movix.
- A challenge issued for a different account/network/domain.
- A challenge already used, superseded, or revoked.
- An XDR that exceeds the request-size limit.

Challenge verification and challenge consumption must behave as one logical transaction. Two concurrent submissions of the same signed challenge may produce at most one successful session.

## 15. Application JWT and Convex contract

### 15.1 Required access-token header

```json
{
  "alg": "RS256",
  "kid": "<active-key-id>",
  "typ": "JWT"
}
```

### 15.2 Required access-token claims

```json
{
  "sub": "<stable Movix user id>",
  "iss": "<exact configured Movix issuer URL>",
  "aud": "<exact configured Convex application id>",
  "iat": 1780000000,
  "exp": 1780000600,
  "jti": "<unique token id>",
  "wallet_address": "G...",
  "stellar_network": "testnet"
}
```

Rules:

- `iss` must exactly match the Convex provider configuration.
- `aud` must exactly match `applicationID`; never omit audience verification.
- Access JWTs are signed, not encrypted. Do not add email, phone, legal identity, secrets, or other unnecessary claims.
- The browser holds the access JWT in memory only.
- The JWT private key is never exposed through JWKS or browser code.

### 15.3 Convex configuration

Add `packages/backend/convex/auth.config.ts` using a custom JWT provider:

- `type: "customJwt"`.
- Exact issuer.
- Exact application ID.
- Public JWKS URL.
- RS256 algorithm unless the approved decision changes.

Update the web provider:

- Replace the plain provider with `ConvexProviderWithAuth`.
- Implement a memoized adapter exposing `isLoading`, `isAuthenticated`, and `fetchAccessToken`.
- `fetchAccessToken({ forceRefreshToken: true })` must call `/api/auth/token` and bypass a cached access token.
- Deduplicate concurrent refresh calls so normal parallel Convex requests cannot look like refresh-token reuse.
- Use Convex `AuthLoading`, authenticated, and unauthenticated behavior for the protected handoff.

### 15.4 Identity mapping

Add one authorization helper for Convex functions:

1. Call `ctx.auth.getUserIdentity()`.
2. Reject null identity.
3. Read the stable `subject`.
4. Load the active Movix user.
5. Confirm the claimed wallet/network still maps to that user where the function requires it.

Sprint 1 needs one protected smoke query such as `auth.currentUser`. The query returns safe user/session identity data and proves that unauthenticated access returns no protected result.

## 16. Persistence model

The exact field names may follow existing project conventions, but the following information and indexes are required.

### 16.1 `authChallenges`

| Field | Rule |
|---|---|
| `challengeId` | Unique opaque identifier |
| `challengeHash` | Unique hash of the canonical challenge; never a reusable raw credential |
| `account` | Normalized verified request account |
| `network` | `testnet` |
| `homeDomain` | Configured value |
| `webAuthDomain` | Configured value |
| `issuedAt` | Server time |
| `expiresAt` | Server time, default five minutes |
| `usedAt` | Optional; set atomically once |
| `supersededAt` | Optional |
| `resultCode` | Restricted categorized outcome, no raw XDR |
| `correlationId` | Privacy-safe trace key |

Indexes:

- By unique challenge hash.
- By account and active/expiry lookup.
- By expiry for cleanup.

### 16.2 `authSessions`

| Field | Rule |
|---|---|
| `sessionId` | Unique internal id |
| `sessionTokenHash` | Hash only; never store raw cookie credential |
| `sessionFamilyId` | Groups rotated credentials |
| `userId` | Stable Movix user |
| `authenticatedWallet` | Verified address |
| `network` | `testnet` |
| `createdAt` | Server time |
| `lastSeenAt` | Updated with bounded frequency |
| `expiresAt` | Maximum seven-day pilot lifetime |
| `rotatedAt` | Optional |
| `replacedBySessionId` | Optional rotation link |
| `revokedAt` | Optional |
| `revocationReason` | Optional controlled enum |
| `jwtKeyId` | Current key used when created/last refreshed |

Indexes:

- By session token hash.
- By user.
- By session family.
- By expiry/revocation for cleanup.

### 16.3 Existing user and wallet records

On first successful authentication:

- Insert one active user if no Testnet wallet mapping exists.
- Insert the verified wallet mapping.
- Use a neutral default timezone such as `UTC` until Sprint 2 collects the actual value.
- Do not request or invent a display name, email, or business profile.

On returning authentication:

- Reuse the same user.
- Update `lastLoginAt` if the schema is extended for it.
- Do not create duplicate user or wallet rows under concurrent verification.

Recommended schema changes:

- Add a unique logical lookup using `wallets.by_address_network`.
- Add `lastLoginAt` to `users`.
- Add the challenge and session tables above.
- Add schema and concurrency tests.

## 17. Cookie and browser-security contract

The deployed refresh/session cookie must be:

- Opaque and generated with cryptographically secure randomness.
- `HttpOnly`.
- `Secure`.
- `SameSite=Lax` or stricter.
- `Path=/`.
- Host-only; use a `__Host-` name in HTTPS environments where practical.
- Cleared on logout and terminal refresh failure.

Additional controls:

- Check `Origin`/host on refresh and logout.
- Use POST for refresh and logout.
- Apply a Content Security Policy suitable for the selected Wallets Kit modules.
- Do not interpolate raw server errors into HTML.
- Use `Cache-Control: no-store` on auth responses.
- Keep private keys in the deployment secret store, not `.env.example` values, Convex tables, or browser bundles.
- Prevent auth route responses from being cached by Next.js or an edge/CDN layer.
- Rate-limit challenge creation and signed-response verification separately.

Local development may use an environment-specific non-`Secure` cookie only when HTTPS is unavailable. The difference must be explicit and must not weaken deployed settings.

## 18. Environment and secret contract

Extend `.env.example` with placeholders and comments, never real key material.

### Public or non-secret server configuration

- `NEXT_PUBLIC_CONVEX_URL`
- `MOVIX_STELLAR_NETWORK=testnet`
- `MOVIX_HOME_DOMAIN`
- `MOVIX_WEB_AUTH_DOMAIN`
- `MOVIX_AUTH_ISSUER`
- `MOVIX_AUTH_AUDIENCE`
- `MOVIX_JWT_ACTIVE_KID`
- Challenge, JWT, and session lifetime values if configurable.

### Server secrets

- `MOVIX_SEP10_SIGNING_SECRET`
- `MOVIX_JWT_PRIVATE_KEY`
- A narrowly scoped auth-store service credential only if the chosen Next/Convex boundary requires one.

### Public keys

- SEP-10 signing public key may be derived server-side and exposed in `stellar.toml`.
- JWT public key may be derived server-side and exposed in JWKS.

Validation rules:

- Server startup fails clearly when required configuration is missing or contradictory.
- Testnet passphrase is fixed and verified.
- Issuer and audience are non-empty exact values.
- Secret values cannot use a `NEXT_PUBLIC_` prefix.
- The SEP-10 signing key cannot equal or derive from the application JWT key.
- Test, development, and pilot environments do not share production-like secrets.

## 19. Detailed backlog for Elliot

## S1-01 — Implement the public landing page

**Priority:** P0  
**Disciplines:** Product, Design, Web  
**Estimate:** 1.5–2 person-days  
**Dependencies:** Movix tokens and shared UI primitives

Tasks:

- Replace the current foundation home page.
- Build header, hero, workflow, protection/security, network/assets, FAQ, CTA, and footer sections.
- Use existing shared Button, Card, Badge, Accordion, and navigation primitives.
- Add semantic landmarks and stable anchor targets.
- Add visible Testnet language.
- Ensure critical content remains readable with gradients/animation disabled.
- Preserve the non-production `/foundation` review route.

Acceptance:

- A visitor can accurately explain what Movix does for buyers and suppliers.
- Primary CTA reaches `/login`.
- Page never claims Stellar proves physical delivery.
- Testnet and supported assets are disclosed.
- No dead anchor or footer link ships.
- Page works at 320px, tablet, and desktop widths without horizontal scrolling.

Likely files:

- `apps/web/app/page.tsx`
- `apps/web/features/marketing/*`
- Shared UI imports from `@repo/ui`

## S1-02 — Make public navigation and content accessible

**Priority:** P0  
**Disciplines:** Design, Web, QA  
**Estimate:** 0.75–1 person-day  
**Dependencies:** S1-01

Tasks:

- Add skip navigation.
- Verify heading order and one clear page `h1`.
- Add keyboard-safe mobile navigation.
- Ensure FAQ uses correct expanded/collapsed semantics.
- Provide visible focus and accessible CTA names.
- Respect reduced motion.
- Add automated axe checks and keyboard smoke tests.

Acceptance:

- All interactive elements work with keyboard only.
- Screen reader landmarks and heading structure are coherent.
- Focus is never lost when mobile navigation opens/closes.
- Automated accessibility tests have no serious/critical violations.

## S1-03 — Implement Freighter connection through Wallets Kit

**Priority:** P0  
**Disciplines:** Stellar, Web  
**Estimate:** 1.5–2 person-days  
**Dependencies:** Current Wallets Kit v2 API, existing `WalletAdapter`

Tasks:

- Add the current JSR-hosted `@creit-tech/stellar-wallets-kit` v2 dependency.
- Enable the Freighter module for the committed path.
- Initialize Wallets Kit only in browser/client code.
- Implement the existing `WalletAdapter` boundary in `packages/stellar`.
- Normalize Wallets Kit errors into project error codes.
- Read and validate address and network/passphrase.
- Subscribe to wallet address/network changes where supported.
- Implement disconnect without coupling it to session revocation.
- Add unit tests with a mocked kit.

Acceptance:

- No Wallets Kit implementation detail leaks into landing/login presentation components.
- Freighter unavailable, access rejected, disconnected, wrong-network, and address-changed states are deterministic.
- Only Testnet and valid standard public keys proceed.
- Rapid connect clicks create one active wallet request.

Likely files:

- `packages/stellar/src/wallet.ts`
- `packages/stellar/src/wallet.test.ts`
- `packages/stellar/package.json`
- `apps/web/features/auth/wallet/*`

## S1-04 — Build and persist SEP-10 challenges

**Priority:** P0  
**Disciplines:** Stellar, Backend  
**Estimate:** 1.5–2 person-days  
**Dependencies:** Server config and key-management decision

Tasks:

- Add the `stellar.toml` route.
- Add challenge persistence and indexes.
- Implement the challenge endpoint.
- Build a Testnet sequence-0, nonce-bearing, time-bounded challenge.
- Sign with the separate SEP-10 key.
- Store restricted challenge metadata/hash.
- Add rate limiting and no-store responses.
- Add deterministic test clock and signing fixtures.

Acceptance:

- A valid request returns a SEP-10 challenge for exactly the requested account and configured domains.
- The signing secret never enters client code or persisted records.
- Two rapid requests cannot leave two usable active challenges for the same intent.
- Invalid address/network/domain configuration fails safely.

Likely files:

- `packages/stellar/src/auth/*`
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/authChallenges.ts`
- `apps/web/app/api/auth/stellar/challenge/route.ts`
- `apps/web/app/.well-known/stellar.toml/route.ts`

## S1-05 — Build the login page and signature UX

**Priority:** P0  
**Disciplines:** Product, Design, Web, Stellar  
**Estimate:** 1.5–2 person-days  
**Dependencies:** S1-03 and S1-04 interfaces

Tasks:

- Create `/login`.
- Implement the canonical state machine.
- Present connect and verify as separate stages.
- Show wallet, full-address access, network, change, and disconnect actions.
- Add the exact no-funds copy before signing.
- Request a challenge only after an explicit user action.
- Ask the connected wallet to sign the challenge using the response passphrase.
- Prevent duplicate requests and stale callbacks.
- Add accessible progress/error/success announcements.

Acceptance:

- A rejected signature creates no user or application session.
- A wallet/network change during signing invalidates the result.
- The user always understands whether Movix is connecting, awaiting signature, verifying, or creating a session.
- Refresh does not restore sensitive pending XDR.

Likely files:

- `apps/web/app/login/page.tsx`
- `apps/web/features/auth/components/*`
- `apps/web/features/auth/hooks/*`
- `apps/web/features/auth/auth-machine.ts`

## S1-06 — Verify and consume signed SEP-10 challenges

**Priority:** P0  
**Disciplines:** Stellar, Backend, QA  
**Estimate:** 2–3 person-days  
**Dependencies:** S1-04

Tasks:

- Implement the token/verification endpoint.
- Parse and verify all checks in Section 14.
- Resolve signature threshold where required.
- Consume the stored challenge atomically.
- Create/find the stable user and verified wallet mapping after verification.
- Add structured security outcomes without raw XDR.
- Add same-challenge concurrency tests.

Acceptance:

- Every required negative case is rejected.
- Exactly one of two concurrent submissions of the same challenge can succeed.
- Malformed or hostile input returns a bounded generic error.
- No user/session record is created before verification succeeds.
- Replay is observable as a categorized security event without logging the XDR.

Likely files:

- `packages/stellar/src/auth/*`
- `packages/backend/convex/authChallenges.ts`
- `packages/backend/convex/users.ts`
- `apps/web/app/api/auth/stellar/token/route.ts`

## S1-07 — Issue application JWTs and authenticate Convex

**Priority:** P0  
**Disciplines:** Backend, Web, DevOps  
**Estimate:** 2–2.5 person-days  
**Dependencies:** S1-06, deployed issuer/JWKS URL

Tasks:

- Add a maintained JWT library with server-only imports.
- Add JWT key parsing and startup validation.
- Add JWKS route.
- Add JWT issuance with the required header/claims.
- Add Convex `auth.config.ts`.
- Add `auth.currentUser` protected smoke query.
- Replace plain Convex provider with a custom authenticated provider.
- Confirm force-refresh behavior.
- Add issuer, audience, algorithm, expiry, key-id, and identity-mapping tests.

Acceptance:

- Convex accepts a valid Movix JWT and rejects wrong issuer, audience, algorithm, expiry, and signature.
- `ctx.auth.getUserIdentity()` resolves the stable Movix subject.
- Unauthenticated clients cannot read the protected smoke query.
- JWKS contains no private key material.
- Convex authentication survives an access-token refresh.

Likely files:

- `apps/web/app/.well-known/jwks.json/route.ts`
- `apps/web/core/auth/*`
- `apps/web/core/providers/convex-provider.tsx`
- `packages/backend/convex/auth.config.ts`
- `packages/backend/convex/auth.ts`

## S1-08 — Add refresh, revocation, logout, and protected handoff

**Priority:** P0  
**Disciplines:** Web, Backend, QA  
**Estimate:** 2–2.5 person-days  
**Dependencies:** S1-07

Tasks:

- Add session persistence and indexes.
- Issue an opaque HttpOnly session credential after SEP-10 verification.
- Implement single-flight, rotating refresh.
- Detect superseded-token reuse.
- Implement idempotent logout and cookie clearing.
- Add `/onboarding/business` protected placeholder.
- Redirect unauthenticated access to `/login` with a safe reason.
- Ensure logout clears Convex auth even if Wallets Kit disconnect fails.
- Add expiry, refresh, revocation, repeated logout, and reuse tests.

Acceptance:

- A valid session renews access without another wallet signature.
- An expired/revoked session cannot renew.
- Logout immediately prevents protected Convex access.
- Refresh credential reuse revokes the affected session family.
- Direct unauthenticated navigation to the protected handoff does not expose data.

Likely files:

- `packages/backend/convex/authSessions.ts`
- `apps/web/app/api/auth/token/route.ts`
- `apps/web/app/api/auth/logout/route.ts`
- `apps/web/app/onboarding/business/page.tsx`
- `apps/web/core/auth/*`

## S1-09 — Complete failure recovery and resilience

**Priority:** P0  
**Disciplines:** Design, Web, Backend, QA  
**Estimate:** 1–1.5 person-days  
**Dependencies:** S1-03 through S1-08

Tasks:

- Implement every error code in Section 12.
- Add bounded retries with no automatic wallet-signature loop.
- Handle expired challenge, signature rejection, network switch, session expiry, and temporary server failure.
- Restore focus to the appropriate control after modal/error transitions.
- Make repeated/late async callbacks harmless.
- Confirm refresh/reload recovery.

Acceptance:

- Every recoverable failure has one clear safe next step.
- Retry never submits a stale signed challenge.
- No error leaks raw XDR, JWT, cookie, secret, or stack trace.
- Late callbacks cannot authenticate the wrong current wallet.

## S1-10 — Instrument the login funnel

**Priority:** P1  
**Disciplines:** Product, Backend  
**Estimate:** 0.5 person-day  
**Dependencies:** Stable states/error codes

Required event names:

- `landing_login_cta_clicked`
- `wallet_selection_opened`
- `wallet_connection_succeeded`
- `wallet_connection_failed`
- `sep10_challenge_issued`
- `sep10_signature_rejected`
- `sep10_verification_succeeded`
- `sep10_verification_failed`
- `auth_session_created`
- `auth_session_refreshed`
- `auth_session_revoked`
- `auth_logout_completed`

Allowed properties:

- Environment.
- Network.
- Wallet module id.
- Result/failure category.
- Coarse duration bucket.
- Correlation id.
- New/returning indicator only if derived safely.

Forbidden properties:

- Raw/full XDR.
- JWT or cookie value.
- Private key or wallet secret.
- Email, phone, business identity, or arbitrary user-entered text.
- Full wallet address in general analytics.

Acceptance:

- The team can calculate supported-wallet login success excluding explicit user rejection.
- Operational/security events remain available even if P1 analytics storage moves.

## 20. Recommended implementation sequence

The work should be merged in vertical, reviewable increments.

1. Configuration validation, auth data shapes, and test fixtures.
2. Wallets Kit adapter with mocked unit tests.
3. Challenge builder/persistence/endpoint with security tests.
4. Signed-challenge verification and atomic replay protection.
5. JWT/JWKS and Convex custom-auth smoke.
6. Refresh session and logout.
7. Minimal login UI that completes the real flow.
8. Protected onboarding handoff.
9. Production landing page.
10. Failure-state, accessibility, Playwright, observability, and polish pass.

Do not build the entire visual flow against fake promises and postpone the real auth boundary until the final days. The mid-sprint gate requires a real signed challenge and Convex identity.

## 21. Ten-day execution plan

## Day 1 — Confirm readiness and freeze contracts

- Re-run Sprint 0 quality gates.
- Confirm the pilot Freighter path and Testnet-only decision.
- Confirm home domain, web-auth domain, issuer, audience, and deployed JWKS origin.
- Confirm who controls the SEP-10 and JWT test/pilot keys.
- Add environment schemas/placeholders.
- Finalize API response and error types.
- Create Sprint 1 work items and owners.

Evidence:

- No unresolved P0 configuration decision.
- No secret checked into the repository.
- State/API/error contracts are reviewable.

## Day 2 — Wallet boundary and landing structure

- Add Wallets Kit v2 through its current package source.
- Implement Freighter adapter and unit mocks.
- Start landing semantic structure and copy.
- Add wallet unavailable/rejected/wrong-network states.

Evidence:

- Mocked wallet connects, disconnects, signs, and changes network.
- Landing content is reviewable without polish.

## Day 3 — Challenge creation

- Add auth challenge schema/indexes.
- Implement Stellar TOML.
- Implement challenge builder and endpoint.
- Add short lifetime, nonce, hashing, supersession, rate-limit seam, and tests.

Evidence:

- Valid Testnet challenge is returned and signed by the configured server key.
- Invalid account/configuration tests pass.

## Day 4 — Verification and replay protection

- Implement signed XDR parsing/validation.
- Add all negative SEP-10 cases.
- Add atomic challenge consumption.
- Add stable user/wallet upsert.

Evidence:

- A valid signed challenge maps to one user.
- Replay and concurrent reuse are rejected.

## Day 5 — JWT, JWKS, and Convex identity

- Implement application JWT issuance.
- Add JWKS.
- Add Convex custom JWT config.
- Add authenticated provider adapter and protected smoke query.

Mid-sprint gate:

- Freighter signs a real challenge.
- Convex sees a valid Movix identity.
- Wrong issuer/audience tokens fail.

If this gate fails, stop landing-page polish and concentrate capacity on the auth path.

## Day 6 — Session refresh and logout

- Add session schema/indexes.
- Add rotating cookie session.
- Add access-token refresh.
- Add revocation/reuse detection.
- Add idempotent logout.

Evidence:

- Access token refreshes without wallet signing.
- Revoked/expired sessions fail.
- Logout removes protected access.

## Day 7 — Complete login experience

- Wire real wallet, challenge, sign, verify, session, and Convex states into `/login`.
- Add connected address/network display.
- Add no-funds copy and progress announcements.
- Add protected onboarding placeholder.

Evidence:

- Real happy path runs end-to-end locally.
- Duplicate submit and stale callback tests pass.

## Day 8 — Failure and accessibility pass

- Complete error catalog.
- Test rejected connection/signature, wrong network, expired challenge, verification failure, and session expiry.
- Complete keyboard, focus, screen-reader, contrast, reduced-motion, and responsive checks.
- Finish landing content.

Evidence:

- Each error has a safe retry.
- No serious/critical automated accessibility violation.

## Day 9 — Integration and browser journeys

- Add Playwright wallet/auth fixtures.
- Run success, logout, reconnect, rejection, expiry, wrong-network, and replay journeys.
- Validate production build and deployed-origin configuration.
- Review logs for sensitive values.

Evidence:

- Required Playwright matrix passes.
- Auth responses use no-store and secure cookie behavior is verified in a deployed HTTPS environment.

## Day 10 — Hardening, demo, and closure

- Run all quality gates from a clean checkout.
- Rehearse happy path and one recovery path.
- Review security checklist.
- Record known limitations and P1 movement.
- Capture screenshots, test results, configuration evidence, and demo notes.

Evidence:

- Sprint exit checklist passes.
- No P0 defect remains open.
- Sprint 2 can trust the authenticated identity boundary.

## 22. Test plan

### 22.1 Stellar/SEP-10 unit and integration tests

- Valid challenge shape and server signature.
- Valid single-signature client response.
- Malformed XDR.
- Wrong sequence.
- Wrong network/passphrase.
- Wrong source/client account.
- Wrong home domain.
- Wrong web-auth domain.
- Expired and not-yet-valid bounds.
- Missing operation.
- Extra operation.
- Altered operation.
- Invalid server signature.
- Missing client signature.
- Wrong client signature.
- Insufficient threshold.
- Unknown challenge hash.
- Superseded challenge.
- Reused challenge.
- Same challenge submitted concurrently.
- Oversized request.

### 22.2 JWT/session tests

- Required headers and claims.
- Correct issuer/audience.
- Wrong issuer.
- Wrong audience.
- Wrong algorithm.
- Unknown `kid`.
- Invalid signature.
- Expired token.
- Future-issued token beyond tolerance.
- JWKS contains only public values.
- Key-rotation fixture.
- Valid refresh.
- Expired refresh.
- Revoked refresh.
- Rotated credential reuse.
- Repeated logout.
- Cookie cleared on logout/failure.
- Convex identity mapping.
- Unauthenticated protected query.

### 22.3 Wallet adapter tests

- Freighter available/unavailable.
- Connection success/rejection.
- Valid/invalid address.
- Testnet/wrong network.
- Signature success/rejection.
- Disconnect.
- Address change.
- Network change.
- Late callback after state change.
- Repeated connect/sign clicks.

### 22.4 Component tests

- Every state in Section 11.
- Address truncation and full copy/view access.
- Disabled/working/loading controls.
- No-funds message present before signature.
- Error-to-retry focus.
- Session-expired presentation.
- Authenticated redirect only after Convex confirmation.
- Landing CTA/FAQ/navigation behavior.

### 22.5 Playwright journeys

Required:

1. Landing to successful login to protected handoff.
2. Wallet connection rejected, then successful retry.
3. Signature rejected, then fresh-challenge retry.
4. Wrong network, switch to Testnet, then success.
5. Expired challenge, then success.
6. Logout blocks protected access.
7. Returning session refresh.
8. Logout and reconnect.
9. Replayed signed challenge is rejected.
10. Address/network changes during authentication invalidate the attempt.

Use deterministic wallet and server fixtures in CI. Run at least one controlled manual smoke with real Freighter against the intended Testnet deployment before Sprint close.

### 22.6 Accessibility and responsive checks

- 320px, tablet, and desktop.
- Keyboard-only.
- Screen-reader smoke.
- Heading/landmark order.
- Accessible dialog/menu names.
- Status/error live regions.
- Visible focus.
- Contrast.
- Reduced motion.
- Zoom/text resize.
- No horizontal scroll in the critical path.

## 23. Quality commands

At minimum, Sprint 1 closure requires:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:a11y
pnpm test:e2e
pnpm build
```

Contract commands remain CI gates even though Sprint 1 should not modify escrow behavior:

```bash
pnpm test:contracts
pnpm build:contracts
```

Add narrower auth commands only if they improve iteration; do not create a second test path that CI ignores.

## 24. Security and privacy review checklist

- [ ] Wallet connection is not treated as authentication.
- [ ] SEP-10 authentication is not treated as organization authorization.
- [ ] Only Testnet is accepted.
- [ ] Only supported standard accounts proceed.
- [ ] SEP-10 server key and JWT key are separate.
- [ ] Challenge is sequence `0`, nonce-bearing, time-bounded, server-signed, and one-time-use.
- [ ] Home domain and web-auth domain are checked.
- [ ] Server and client signatures are checked.
- [ ] Unexpected operations/signatures are rejected.
- [ ] Replay consumption is atomic.
- [ ] Auth endpoints are rate-limited and no-store.
- [ ] JWT issuer, audience, algorithm, key id, issue time, and expiry are verified.
- [ ] Access JWT is short-lived and held in memory.
- [ ] Refresh credential is opaque, rotating, HttpOnly, and stored only as a hash server-side.
- [ ] Refresh reuse revokes the session family.
- [ ] Logout is idempotent and clears browser/server auth.
- [ ] Convex protected functions derive identity from `ctx.auth`, never client-supplied user ids.
- [ ] No private key, secret, token, raw/signed XDR, or unnecessary PII appears in logs.
- [ ] JWKS exposes public material only.
- [ ] CSP and origin checks support the selected wallet path without broad unsafe allowances.
- [ ] Mainnet is neither selectable nor implied.

## 25. Risks and controls

| Risk | Probability | Impact | Control | Trigger |
|---|---|---|---|---|
| Wallets Kit v1 examples cause incompatible implementation | Medium | Medium | Use current v2/JSR docs and wrap behind adapter | Imports or constructor match deprecated v1 tutorial |
| Auth architecture is deferred behind UI mocks | Medium | High | Mid-sprint real Convex identity gate | No real signed challenge by Day 5 |
| Replay race creates two sessions | Medium | Critical | Atomic consume and concurrency test | Two submissions both return success |
| JWT accepted for wrong audience | Low | Critical | Required Convex `applicationID` and negative test | Audience omitted or unchecked |
| Browser stores long-lived bearer token | Medium | High | Memory-only access token and HttpOnly rotating cookie | Token written to local/session storage |
| Wallet/network changes create identity mismatch | Medium | High | Change listeners, snapshot comparison, fresh flow | Signed response belongs to stale wallet |
| Domain/config mismatch breaks deployed login | Medium | High | Exact config validation and deployment smoke | Local works but preview/pilot returns unauthorized |
| Sensitive artifacts leak to logs | Medium | Critical | Structured categories and log review | XDR/token/address appears in general logs |
| One implementer exceeds two-week capacity | High | Medium | Preserve P0; move analytics and extra wallets | Mid-sprint gate misses Day 5 |
| Marketing overstates escrow guarantees | Medium | High | Copy contract and Product review | “Blockchain proves delivery” or “guaranteed” appears |

## 26. Definition of done

Every completed Sprint 1 item must:

- Meet its story acceptance criteria.
- Reuse shared UI primitives.
- Cover loading, disabled, pending, error, retry, and success states.
- Work at mobile, tablet, and desktop sizes.
- Pass keyboard and screen-reader smoke checks.
- Include proportional unit, component, integration, and end-to-end tests.
- Prevent duplicate submission and stale async writes.
- Keep server-only secrets out of client code.
- Produce safe operational evidence for auth success/failure.
- Pass format, lint, typecheck, tests, accessibility, end-to-end, and build gates.

## 27. Sprint exit checklist

Product and content:

- [ ] Landing explains buyer and supplier value accurately.
- [ ] Landing does not claim independent delivery proof.
- [ ] Testnet and supported assets are disclosed.
- [ ] Login states that signing in does not transfer funds.
- [ ] FAQ and footer contain no dead or unsupported claim.

Wallet and SEP-10:

- [ ] Freighter connects through Wallets Kit.
- [ ] Wrong network is blocked.
- [ ] Valid challenge is short-lived and server-signed.
- [ ] Signed challenge is fully verified.
- [ ] Replay and concurrent reuse are rejected.
- [ ] Wallet/network change forces a fresh flow.

Session and Convex:

- [ ] Valid Movix JWT authenticates Convex.
- [ ] Wrong issuer/audience/algorithm/signature/expiry is rejected.
- [ ] Refresh rotates the session credential.
- [ ] Expired/revoked/reused credentials fail.
- [ ] Logout removes protected access.
- [ ] `/onboarding/business` is protected.

Quality:

- [ ] All required unit/integration tests pass.
- [ ] All required component tests pass.
- [ ] Required Playwright journeys pass.
- [ ] Manual real-Freighter Testnet smoke passes.
- [ ] Accessibility checks pass.
- [ ] 320px/tablet/desktop checks pass.
- [ ] Production build passes.
- [ ] Log review finds no sensitive artifacts.
- [ ] No P0 defect remains open.

## 28. Required review evidence

Attach or link:

- Landing screenshots at 320px and desktop.
- Login screenshots for disconnected, connected, signing, error, and success states.
- Test output for SEP-10 negative cases.
- Replay/concurrency test result.
- Decoded sample JWT header/claims with safe fixture values only.
- JWKS response with public fixture/test key only.
- Convex authenticated and unauthenticated smoke evidence.
- Cookie attribute evidence from deployed HTTPS preview/pilot.
- Playwright report.
- Accessibility report.
- Real-Freighter Testnet smoke result.
- Environment/configuration checklist with secret values redacted.
- Known limitations and moved P1 items.

## 29. Sprint closure decision

Choose exactly one:

### Complete

All P0 exit criteria pass. Sprint 2 may trust the authenticated user boundary.

### Conditional close

Only non-blocking P1 analytics, extra-wallet, or cosmetic work remains. Each item has an owner and destination sprint.

### Not complete

Any of the following remains:

- Wallet connection is mistaken for authentication.
- SEP-10 validation or replay protection is incomplete.
- JWT issuer/audience/signature/expiry validation is incomplete.
- Convex cannot verify the Movix identity.
- Session refresh or logout does not revoke protected access.
- Server secrets or long-lived tokens reach browser storage.
- Critical recovery or accessibility path is missing.
- The real Freighter/Testnet path has not been demonstrated.

Do not relabel these gaps as Sprint 2 onboarding work.

## 30. Handoff to Sprint 2

Sprint 2 may assume:

- `ctx.auth.getUserIdentity()` returns a stable Movix user subject.
- `auth.currentUser` resolves that subject to one active user and verified Testnet wallet.
- Unauthenticated access is rejected.
- Session refresh/logout behavior is owned by the shared auth layer.
- `/onboarding/business` is the authenticated entry point.

Sprint 2 still owns:

- Display name, locale/timezone confirmation, and contact fields.
- Organization creation.
- Owner membership creation.
- Buyer/supplier capabilities.
- Active organization selection.
- Business-route authorization and application shell.

## 31. Elliot start checklist

Before coding:

- [ ] Read this document and the Sprint 0 decisions.
- [ ] Confirm the deployed preview/pilot origins used for home domain, web-auth domain, issuer, audience, and JWKS.
- [ ] Obtain safe test keys through the agreed secret process.
- [ ] Confirm Freighter is the only P0 wallet.
- [ ] Confirm current Wallets Kit v2 API/imports; do not copy a v1 constructor tutorial.
- [ ] Confirm the selected Stellar SDK SEP-10 helper behavior against the current SEP.
- [ ] Create work items S1-01 through S1-10 with dependencies.
- [ ] Build the real authentication path by the Day 5 gate.

When uncertain, preserve the trust boundaries in this document and escalate the decision. Do not weaken verification or session controls to make the UI demo pass.

## 32. Current implementation references

Re-check these before implementation because wallet/auth libraries and hosted documentation can change:

- [SEP-10: Stellar Web Authentication](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md)
- [Stellar SEP-10 documentation](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep10)
- [Stellar Wallets Kit documentation](https://stellarwalletskit.dev/)
- [Stellar Wallets Kit v2 package documentation](https://jsr.io/@creit-tech/stellar-wallets-kit/doc)
- [Convex custom JWT provider](https://docs.convex.dev/auth/advanced/custom-jwt)
- [Convex custom authentication client integration](https://docs.convex.dev/auth/advanced/custom-auth)

## 33. Sign-off

| Discipline | Owner | Status | Date | Notes |
|---|---|---|---|---|
| Product | Nicole/Chris | Pending | — | — |
| Design | TBD | Pending | — | — |
| Web | Elliot | Pending | — | — |
| Backend/Auth | Elliot/TBD | Pending | — | — |
| Stellar | Elliot/TBD | Pending | — | — |
| QA | TBD | Pending | — | — |
| DevOps | TBD | Pending | — | — |

Final product sign-off requires:

- Sprint goal achieved.
- All P0 evidence present.
- No unresolved authentication, key, replay, session, or identity ambiguity.
- Sprint 2 can build business onboarding without modifying the Sprint 1 identity contract.
