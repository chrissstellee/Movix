# Sprint 1 Authentication API Contract

## Conventions

- Browser authentication calls are same-origin.
- Authentication responses use `Cache-Control: no-store`.
- Refresh and logout validate the request origin/host.
- JSON request bodies use `Content-Type: application/json` and are size-limited.
- Client errors expose stable categories and safe user messages, not internal stack traces or cryptographic material.
- Server logs may retain a privacy-safe correlation identifier and controlled result category only.

The TypeScript implementation remains the executable source of truth. Contract changes require corresponding tests and documentation updates.

## Public discovery endpoints

### `GET /.well-known/stellar.toml`

Advertises the SEP-10 public signing key and the deployed web-auth endpoint.

Required properties:

- valid TOML;
- `SIGNING_KEY` matches the configured server SEP-10 key;
- `WEB_AUTH_ENDPOINT` uses the deployed Movix origin;
- no private or session material;
- HTTPS for preview/pilot deployments.

### `GET /.well-known/jwks.json`

Publishes public application JWT verification keys for Convex.

Each active or retiring signing key includes `kid`, `kty`, `alg`, and `use: "sig"`. Cache headers must permit rotation without an excessive stale interval. A retiring public key remains available until every access token signed by it has expired.

### Development-only Convex JWKS bridge

Cloud Convex development deployments cannot fetch `localhost`. Local setup therefore
publishes the same active **public** RSA JWK at
`GET /.well-known/movix-auth-jwks.json` on the selected Convex HTTP Actions site and
configures `MOVIX_AUTH_JWKS_URL` to that endpoint. The bridge rejects empty, malformed,
non-RSA, non-RS256, and private key material. Deployed environments use the canonical
Next.js `/.well-known/jwks.json` endpoint instead.

## Authentication endpoints

The canonical split routes are:

| Purpose                                       | Canonical route                   |
| --------------------------------------------- | --------------------------------- |
| Issue challenge                               | `GET /api/auth/stellar/challenge` |
| Verify signed challenge and establish session | `POST /api/auth/stellar/token`    |
| Refresh access token and rotate session       | `POST /api/auth/token`            |
| Revoke session and clear cookie               | `POST /api/auth/logout`           |

For SEP-10 client compatibility, `GET /api/auth/stellar` delegates to the canonical challenge handler and `POST /api/auth/stellar` delegates to the canonical signed-challenge handler. `stellar.toml` advertises `/api/auth/stellar`. Movix web code uses the split routes. Compatibility and canonical variants therefore share validation, responses, cookies, rate limits, and tests; they are not separate implementations.

### `GET /api/auth/stellar/challenge`

Compatibility route: `GET /api/auth/stellar`.

Query parameter:

| Name      | Type   | Rule                                                     |
| --------- | ------ | -------------------------------------------------------- |
| `account` | string | Valid standard Stellar public account; Testnet flow only |

Success fields:

| Field               | Type   | Meaning                                                         |
| ------------------- | ------ | --------------------------------------------------------------- |
| `transactionXdr`    | string | Base64-encoded challenge returned only to the requesting client |
| `networkPassphrase` | string | Exact Stellar Testnet network passphrase                        |
| `expiresAt`         | number | Server expiry time in milliseconds                              |

Server behavior:

- validate the account before challenge construction;
- use sequence `0`, configured home/web-auth domains, a unique nonce, and a default five-minute lifetime;
- sign with the SEP-10 key;
- persist only the restricted verification record and canonical challenge hash;
- supersede any prior active challenge for the same login intent;
- apply intent/account and coarse trusted-proxy network rate limits using separate
  privacy-safe HMAC namespaces, without disclosing account existence. If no supported
  proxy-provided client address is available, the coarse limiter deliberately uses a
  shared fail-safe bucket.

### `POST /api/auth/stellar/token`

Compatibility route: `POST /api/auth/stellar`.

Request field:

| Field                  | Type   | Rule                                                                                                   |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `signedTransactionXdr` | string | Signed SEP-10 response; never logged or stored as evidence; request/body limit 65,536 bytes/characters |

Success fields:

| Field                | Type        | Meaning                                                |
| -------------------- | ----------- | ------------------------------------------------------ |
| `accessToken`        | string      | Short-lived Convex-compatible JWT; browser memory only |
| `expiresAt`          | number      | Access-token expiry in milliseconds                    |
| `user.id`            | string      | Stable Movix user identifier                           |
| `user.walletAddress` | string      | Verified standard Stellar account                      |
| `user.network`       | `"testnet"` | Fixed pilot network                                    |

The server validates format, sequence, source/client account, Testnet passphrase, domains, time bounds, operation set/order, server signature, client signature, and required threshold. It rejects unexpected operations or signers, looks up the issued challenge hash, and consumes it atomically. Only after verification may it upsert the user/wallet, create a hashed refresh session, set the cookie, and mint an access JWT.

At most one concurrent submission of a challenge succeeds.

### `POST /api/auth/token`

Reads the HttpOnly session cookie; no request body is required.

Success fields:

| Field                | Type        | Meaning                                |
| -------------------- | ----------- | -------------------------------------- |
| `accessToken`        | string      | New short-lived access JWT             |
| `expiresAt`          | number      | Expiry in milliseconds                 |
| `user.id`            | string      | Stable Movix user identifier           |
| `user.walletAddress` | string      | Verified wallet for the session family |
| `user.network`       | `"testnet"` | Fixed pilot network                    |

The endpoint validates hash, expiry, revocation, active user status, and rotation family;
rotates the credential on every success; issues a new `jti` with the current `kid`; and
sets the replacement cookie. An immediate duplicate use within the five-second
concurrency grace returns retryable `409 session_conflict` without clearing the current
cookie. Reuse after that grace revokes the affected session family. Missing, expired, or
revoked sessions return `401` without internal detail.

### `POST /api/auth/logout`

Revokes the current session and clears the cookie. The operation is idempotent and returns
success when the persisted session is already absent or the request is repeated. If the
auth store cannot confirm revocation, the endpoint returns `503` and deliberately retains
the cookie so revocation can be retried.

## Server-to-Convex auth-store routes

These routes are not browser APIs. The Next.js server calls the Convex HTTP Actions site configured by `MOVIX_AUTH_STORE_URL` and authenticates with `Authorization: Bearer` using `MOVIX_AUTH_STORE_SECRET`.

| Method and path                          | Purpose                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `POST /internal/auth/challenges/issue`   | Persist/supersede a challenge and apply issue rate limiting                        |
| `POST /internal/auth/verification/check` | Apply intent and coarse-network limits before XDR parsing or Horizon lookup        |
| `POST /internal/auth/challenges/consume` | Atomically consume the challenge, map the user/wallet, and create a session family |
| `POST /internal/auth/sessions/refresh`   | Rotate the hashed session credential and detect reuse                              |
| `POST /internal/auth/sessions/logout`    | Revoke the current session idempotently                                            |

Internal requests require JSON, are limited to 65,536 bytes, use a ten-second server-side timeout, and are sent with `cache: "no-store"`. Convex responses use `Cache-Control: no-store` and a restrictive `Content-Security-Policy`. Unauthorized requests return `403`; invalid payloads return `400`.

## Convex protected contract

### `auth.currentUser`

This protected smoke query:

1. obtains identity from `ctx.auth.getUserIdentity()`;
2. rejects unauthenticated access;
3. resolves the trusted Movix user;
4. confirms that the user is active and the session family is not revoked;
5. confirms the verified Testnet wallet mapping;
6. returns only safe identity data needed by the client.

A client-supplied user identifier is never accepted for authorization.

## Application JWT

Required protected header:

| Claim | Rule                                                     |
| ----- | -------------------------------------------------------- |
| `alg` | `RS256` unless an approved ADR and tests change together |
| `kid` | Current published verification key                       |
| `typ` | `JWT`                                                    |

Required claims:

| Claim             | Rule                                                   |
| ----------------- | ------------------------------------------------------ |
| `sub`             | Stable internal Movix user identifier                  |
| `iss`             | Exact configured Movix issuer URL                      |
| `aud`             | Exact configured Convex application ID                 |
| `iat` / `exp`     | Server issue/expiry time; default lifetime ten minutes |
| `jti`             | Unique token identifier                                |
| `wallet_address`  | Verified wallet claim                                  |
| `stellar_network` | `testnet`                                              |

JWTs are signed, not encrypted. Do not add email, phone, business identity, secrets, or other unnecessary claims.

## Stable error catalog

| Code                  | HTTP intent                                     | Safe recovery                             |
| --------------------- | ----------------------------------------------- | ----------------------------------------- |
| `invalid_request`     | Malformed, wrong-origin, or unsupported request | Correct the request or restart safely     |
| `invalid_account`     | Invalid/non-standard Stellar account            | Choose a standard Stellar `G...` account  |
| `wallet_unavailable`  | Client wallet unavailable                       | Install/open Freighter, then retry        |
| `wallet_rejected`     | Wallet access/signature declined                | Retry the user-initiated action           |
| `wrong_network`       | Non-Testnet wallet                              | Switch to Testnet and recheck             |
| `rate_limited`        | Too many issue/verify attempts                  | Respect `Retry-After`/`retryAfterSeconds` |
| `challenge_expired`   | Challenge time bound ended                      | Request a fresh challenge                 |
| `challenge_invalid`   | Verification failed                             | Start fresh; retain safe wallet state     |
| `challenge_replayed`  | Challenge already consumed                      | Start fresh; emit security event          |
| `session_expired`     | Refresh session ended                           | Sign in again                             |
| `session_revoked`     | Session was explicitly revoked                  | Sign in again                             |
| `session_reused`      | Superseded credential was reused                | Family is revoked; sign in again          |
| `session_conflict`    | Another tab just rotated the credential         | Retry once with the replacement cookie    |
| `service_unavailable` | Temporary server failure                        | Bounded manual retry                      |

Authentication failures may use a generic client response while the server retains the stable categorized result. Status-code mappings must be defined once in the implementation and asserted by contract tests.

Error responses use:

| Field                     | Type             | Meaning                               |
| ------------------------- | ---------------- | ------------------------------------- |
| `error.code`              | stable string    | Machine-readable category             |
| `error.message`           | string           | Safe user-facing explanation          |
| `error.correlationId`     | string           | Privacy-safe diagnostic reference     |
| `error.retryAfterSeconds` | number, optional | Delay also reflected in `Retry-After` |

## Change control

Update this contract with any endpoint, payload, status/error, cookie side effect, JWT claim, or protected-query change. Security-sensitive changes also update the [runbook](security-operations-runbook.md), [ADR](../decisions/ADR-001-sprint-1-auth-boundary.md), and [test matrix](testing-and-evidence.md).
