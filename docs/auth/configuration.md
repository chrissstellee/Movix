# Sprint 1 Authentication Configuration

## Principles

- `.env.example` contains names, placeholders, and comments only.
- Deployment secrets live in the approved secret store.
- No secret uses a `NEXT_PUBLIC_` prefix or enters a browser bundle.
- Development, test, and pilot environments use different signing/session material.
- Startup fails clearly when required values are missing, contradictory, or unsafe.

## Configuration matrix

| Variable                         | Exposure             | Consumer                                | Required rule                                                                                 | Owner         |
| -------------------------------- | -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_CONVEX_URL`         | Public               | Web client                              | Valid Convex deployment URL                                                                   | DevOps        |
| `MOVIX_STELLAR_NETWORK`          | Server config        | Web/auth backend                        | Exact value `testnet`                                                                         | Elliot        |
| `MOVIX_HOME_DOMAIN`              | Public server config | SEP-10 builder/verifier                 | Exact deployed home domain                                                                    | DevOps        |
| `MOVIX_WEB_AUTH_DOMAIN`          | Public server config | SEP-10 builder/verifier                 | Exact deployed auth domain                                                                    | DevOps        |
| `MOVIX_AUTH_ISSUER`              | Public server config | JWT issuer/Convex                       | Exact HTTPS issuer URL in deployed environments                                               | DevOps        |
| `MOVIX_AUTH_AUDIENCE`            | Public server config | JWT issuer/Convex                       | Exact Convex application ID                                                                   | Elliot/DevOps |
| `MOVIX_AUTH_JWKS_URL`            | Public Convex config | Convex JWT verifier                     | HTTPS JWKS URL in deployed environments; local cloud development uses the Convex JWKS bridge  | Elliot/DevOps |
| `MOVIX_AUTH_PUBLIC_JWKS`         | Public Convex config | Local-development JWKS bridge           | Public RSA JWK set only; never private key fields                                             | Elliot/DevOps |
| `MOVIX_AUTH_STORE_URL`           | Server config        | Next.js auth gateway                    | Convex HTTP Actions site origin; never the public browser Convex URL                          | DevOps        |
| `MOVIX_HORIZON_URL`              | Server config        | SEP-10 verifier                         | Valid Horizon URL; defaults to `https://horizon-testnet.stellar.org`                          | Elliot/DevOps |
| `MOVIX_JWT_ACTIVE_KID`           | Public server config | JWT issuer/JWKS                         | Identifies current signing key                                                                | DevOps        |
| `MOVIX_JWT_RETIRING_PUBLIC_KEYS` | Public server config | JWKS publisher                          | JSON array of unexpired `{ "retireAt": number, "jwk": public RSA JWK }` entries; default `[]` | DevOps        |
| `MOVIX_SEP10_CHALLENGE_SECONDS`  | Server config        | SEP-10 service/login-intent cookie      | Integer `60`–`300`; default `300`                                                             | Security      |
| `MOVIX_JWT_ACCESS_SECONDS`       | Server config        | JWT issuer                              | Integer `60`–`600`; default `600`                                                             | Security      |
| `MOVIX_SESSION_DAYS`             | Server config        | Session service                         | Integer `1`–`7`; default `7`                                                                  | Security      |
| `MOVIX_SEP10_SIGNING_SECRET`     | Secret               | SEP-10 service only                     | Valid Stellar signing secret, distinct from JWT key                                           | DevOps        |
| `MOVIX_JWT_PRIVATE_KEY`          | Secret               | JWT issuer only                         | RSA private key matching active `kid`; escaped newlines are normalized                        | DevOps        |
| `MOVIX_RATE_LIMIT_HMAC_SECRET`   | Secret               | Next.js auth routes                     | At least 32 characters; keys login intent, rate-limit, and privacy-safe wallet fingerprints   | DevOps        |
| `MOVIX_AUTH_STORE_SECRET`        | Secret               | Next.js gateway and Convex HTTP Actions | Shared bearer secret of at least 32 characters; must differ from every signing/HMAC secret    | DevOps        |

`MOVIX_AUTH_STORE_SECRET`, `MOVIX_AUTH_ISSUER`, `MOVIX_AUTH_AUDIENCE`,
`MOVIX_AUTH_JWKS_URL`, and `MOVIX_AUTH_PUBLIC_JWKS` must also be configured in the
Convex deployment. The remaining server values are consumed by the Next.js runtime.
For deployed environments, `MOVIX_AUTH_JWKS_URL` points to the canonical Next.js JWKS
endpoint. The Convex-hosted bridge exists so a cloud development deployment can verify
JWTs issued from localhost; it publishes public key material only.

## Derived public material

- The SEP-10 signing public key may be derived server-side and published through `stellar.toml`.
- JWT public keys may be derived server-side and published through JWKS.
- Public derivation must never expose private key material.

## Validation requirements

At startup or deployment validation:

- enforce Stellar Testnet and its exact network passphrase;
- require non-empty exact home domain, web-auth domain, issuer, and audience;
- require a valid auth-store URL and Horizon URL;
- require a current `kid`;
- validate the exact challenge, JWT, and session bounds shown above;
- reject secrets using public prefixes;
- ensure SEP-10, JWT, rate-limit HMAC, and auth-store secrets are distinct;
- reject malformed keys before serving authentication traffic;
- ensure configured issuer, discovery origin, and JWKS URL agree.
- parse `MOVIX_JWT_RETIRING_PUBLIC_KEYS` as a JSON array and reject private RSA fields; ignore expired entries.
- configure the deployment proxy to replace, rather than append untrusted input to, a
  supported client-address header (`x-vercel-forwarded-for`, `cf-connecting-ip`, or
  `x-real-ip`); direct runtime access must be blocked. Without one, coarse authentication
  throttling intentionally shares a fail-safe bucket.

## Local development

Local HTTP development may use a clearly named non-`Secure` cookie mode only when HTTPS is unavailable. Deployed preview and pilot environments always use the secure cookie contract. Do not make production behavior depend on an unchecked development default.

Use safe development keys obtained through the agreed secret process. Never copy pilot or production-like keys into a local file committed to Git.

## Deployment checklist

- [ ] Preview/pilot origins are confirmed.
- [ ] Home and web-auth domains exactly match deployment.
- [ ] Issuer and Convex audience exactly match both JWT and Convex configuration.
- [ ] `MOVIX_AUTH_STORE_URL` is the intended Convex HTTP Actions site origin.
- [ ] Next.js and Convex contain the same `MOVIX_AUTH_STORE_SECRET`.
- [ ] Horizon points to the intended Testnet service.
- [ ] Separate SEP-10, JWT, rate-limit HMAC, and auth-store secrets are present.
- [ ] Active `kid` appears in public JWKS.
- [ ] Retiring-key JSON contains public RSA JWKs only and retains them until their access tokens expire.
- [ ] Cookie is host-only, `HttpOnly`, `Secure`, `SameSite=Lax` or stricter, and `Path=/`.
- [ ] Auth responses are not cached by Next.js, edge, or CDN layers.
- [ ] The trusted proxy overwrites a supported client-address header and direct runtime access is blocked.
- [ ] No secret value appears in build output, browser code, logs, screenshots, or evidence.

Record only redacted completion evidence in the [Sprint 1 manifest](../evidence/sprint-01/README.md).

## Rotation ownership

DevOps owns key custody and rotation execution. Elliot owns implementation compatibility and automated tests. Security approves overlap and revocation policy. Bri updates this matrix and the runbook when names or procedures change.
