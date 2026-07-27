# Sprint 2 Evidence Manifest

Status: collection pending. Do not mark Sprint 2 complete from implementation-only results.

## Artifact naming

Use immutable, non-sensitive IDs:

`S2-<scenario>-<commit12>-<environment>-<sequence>`

Example: `S2-DRAFT-RESUME-a1b2c3d4e5f6-test-01`.

Each record must state AC IDs, full immutable commit, safe environment label, operator, UTC time, command/journey, result, linked defect, and artifact path. Screenshots and logs must be reviewed before commit.

## Redaction rules

Never include live business names or PII, full wallet addresses, organization/tenant IDs, draft contents, completion keys, registration/tax values, auth tokens, cookies, session identifiers, raw audit rows, private keys, secrets, or unredacted browser/log/environment output.

Use deterministic fictional fixtures and shortened wallet labels. Replace identifiers with stable scenario labels. Evidence proving denial should record the expected error code and count/result, not foreign data.

## Required groups

- domain and normalization;
- draft resume/stale/concurrency;
- atomic completion/rollback/idempotency;
- authorization and foreign-child denial;
- route and capability variants;
- settings concurrency and audit-once;
- accessibility and responsive checks;
- 13 Playwright journeys;
- migration inventory/dry-run/verification;
- Sprint 1 prerequisite gate;
- QA, Security, DevOps, Product, Elliot, and Bri sign-offs.
