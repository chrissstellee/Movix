# Sprint 1 Security and Operations Runbook

## Scope

This runbook covers SEP-10 challenge service, application JWT/JWKS, rotating browser sessions, Convex authentication, and the Freighter/Testnet login boundary. It does not cover payments, organization authorization, or Mainnet.

## Routine pre-deploy

1. Confirm the deployment is Testnet-only and uses the approved origin values.
2. Validate configuration with secret values redacted.
3. Confirm SEP-10 and JWT keys are different and the active `kid` is published.
4. Run all quality gates and attach results to the evidence manifest.
5. Verify auth endpoints are same-origin, `no-store`, and excluded from edge/CDN caching.
6. Verify the trusted edge overwrites the configured client-address header and direct
   runtime access is blocked; exercise both intent and coarse-network throttles.
7. Verify deployed cookie attributes over HTTPS.
8. Run authenticated and unauthenticated Convex smoke tests.
9. Run replay/concurrency and refresh-reuse tests.
10. Review logs for forbidden data.
11. Complete one controlled Freighter/Testnet smoke and record only its result and environment.

Manual and deployed proof is currently **pending** until captured in the Sprint 1 environment.

## Key rotation

### JWT signing key

1. Provision a new key in the deployment secret store.
2. Assign a new unique `kid`.
3. Publish the new public key in JWKS while retaining the retiring public key.
4. Deploy token issuance using the new active key.
5. Verify Convex accepts a newly issued access token.
6. Retain the retiring public key until all tokens it signed have expired, including allowed clock tolerance.
7. Remove the retiring private key from active service, then remove its public key after the overlap window.
8. Record dates, owners, environment, and redacted verification evidence.

### SEP-10 key

Changing the SEP-10 key requires coordinated `stellar.toml`, challenge builder/verifier, deployment secret, and smoke-test updates. Drain or invalidate outstanding challenges before completing the switch. Record the change as a security decision if it changes the established procedure.

Never copy private key values into an issue, document, terminal transcript, screenshot, or test artifact.

## Session-family revocation

Revoke the affected family when:

- a superseded refresh credential is reused;
- a credential is suspected exposed;
- server-side session integrity cannot be established;
- an operator performs an approved containment action.

The server marks the family revoked, refuses further refresh, clears the browser cookie on the next response where possible, and emits a controlled security event. Access JWTs naturally expire within their short lifetime; emergency changes to that behavior require a separate decision.

## Incident triage

### Challenge replay or concurrent double success

1. Treat two successful submissions for one challenge as a critical P0 defect.
2. Disable or constrain the affected authentication path if safe atomic consumption cannot be guaranteed.
3. Identify affected correlation identifiers without retrieving or logging challenge material.
4. Revoke sessions created by the affected attempt.
5. preserve categorized server events and test output.
6. Fix and rerun replay plus concurrent-submission tests before restoring service.

### Refresh credential reuse

1. Treat reuse within the five-second rotation grace as a concurrency conflict; return
   `409`, retain the cookie, and let the client retry once after the successful tab's
   replacement cookie is visible.
2. For reuse after the grace, revoke the entire session family.
3. Return a generic unauthenticated response and clear the cookie.
4. Confirm no later credential in that family remains active.
5. Record the controlled reason, correlation identifier, and coarse timing.
6. Investigate client refresh deduplication before concluding malicious reuse.

### Logout store failure

1. Do not acknowledge logout or clear the refresh cookie until idempotent family
   revocation succeeds.
2. Return a privacy-safe `503 service_unavailable` response and retain the cookie for a
   bounded user-initiated retry.
3. Confirm the retry revokes the family before capturing cookie-clearing evidence.

### Domain, issuer, audience, or JWKS mismatch

1. Stop issuing sessions if tokens cannot be verified reliably.
2. Compare exact deployed origin configuration with `stellar.toml`, JWT claims, Convex provider settings, and JWKS discovery.
3. Do not weaken issuer or audience validation as a workaround.
4. Correct configuration, redeploy, then rerun positive and negative identity smoke tests.

### Authentication service unavailable

1. Preserve existing safe wallet display only when still accurate.
2. Return `service_unavailable` with a bounded manual retry; never loop wallet signatures.
3. Check Convex, key/config validation, rate limiting, and deployment health.
4. Do not expose raw upstream errors to the browser.

### Suspected sensitive-data logging

1. Restrict access to the affected logs and stop the source.
2. Determine whether a secret, credential, JWT, cookie, wallet secret, private key, or raw/signed authentication transaction was recorded.
3. Rotate/revoke affected material using the appropriate procedure.
4. Remove or expire artifacts under the organization retention policy.
5. add a regression test or structured-logging guard.

## Privacy-safe observability

Allowed event properties:

- environment and Testnet network;
- wallet module identifier;
- controlled result/failure category;
- coarse duration bucket;
- privacy-safe correlation identifier;
- safely derived new/returning indicator.

Forbidden:

- private keys or wallet secrets;
- JWTs, cookies, or raw session credentials;
- raw or signed authentication transactions;
- full wallet addresses in general analytics;
- email, phone, business identity, or arbitrary user text.

Required event names are listed in the Sprint 1 specification. Operational/security events remain available even if P1 analytics persistence is deferred.

## Challenge and session cleanup

Cleanup jobs operate on indexed expiry/revocation fields in bounded batches. Cleanup must not weaken the ability to reject replay during the required retention window or turn raw credentials into stored records. The final retention window and schedule must be recorded before pilot deployment.

## Rollback and closure criteria

Rollback or disable authentication when any of these is true:

- replay/concurrency permits multiple successful sessions;
- issuer, audience, signature, algorithm, key, or expiry validation is bypassed;
- private signing material or long-lived bearer tokens reach the browser;
- refresh reuse does not revoke the family;
- logout retains protected Convex access;
- deployed domain mismatch cannot be corrected safely.

Service is restored only after the relevant automated regression, deployed smoke, and security evidence pass. Sprint closure follows the decision rules in [testing and evidence](testing-and-evidence.md).
