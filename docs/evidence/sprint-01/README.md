# Sprint 1 Evidence Manifest

This directory indexes review evidence for the landing page and SEP-10 authentication slice. Evidence proves behavior; it must never become a storage location for authentication material.

## Handling rules

Do not commit:

- private keys, wallet secrets, or secret-store output;
- JWTs, cookie values, raw refresh credentials, or live session identifiers;
- raw or signed authentication transactions;
- full live wallet addresses;
- unredacted environment values or request/response traces containing protected material.

Use deterministic fixtures where inspectable values are required. Crop or redact screenshots and logs before committing. Store large generated Playwright reports in CI artifacts and link them rather than committing the report tree.

## Artifact register

| ID | Artifact | Expected location/link | Owner | Status |
|---|---|---|---|---|
| UI-01 | Landing at 320px | Local Playwright attachment; CI link pending | QA | Pass locally |
| UI-02 | Landing desktop | `ui/landing-desktop.png` | QA | Pending |
| UI-03 | Login state set | `ui/login-states.md` or safe images | QA | Pending |
| TEST-01 | SEP-10 negative matrix | CI artifact link | Elliot/QA | Pending |
| TEST-02 | Replay/concurrency result | `packages/backend/convex/authStore.test.ts` | Elliot/QA | Pass locally |
| TEST-03 | JWT/session negative matrix | CI artifact link | Elliot/QA | Pending |
| TEST-04 | Playwright report | Local uncommitted report; CI link pending | QA | Pass locally |
| A11Y-01 | Accessibility report and manual smoke | Automated local result; manual smoke pending | QA | Partial |
| SEC-01 | Fixture-only decoded JWT header/claims | `security/jwt-fixture-review.md` | Elliot | Pending |
| SEC-02 | Public fixture/test JWKS review | `security/jwks-review.md` | Elliot | Pending |
| SEC-03 | Sensitive-log review | `security/log-review.md` | Security | Pending |
| DEPLOY-01 | Convex authenticated/unauthenticated smoke | `deployment/convex-smoke.md` | Elliot | Pending |
| DEPLOY-02 | HTTPS cookie attributes | `deployment/cookie-review.md` | DevOps | Pending |
| DEPLOY-03 | Redacted configuration checklist | `deployment/configuration.md` | DevOps | Pending |
| MANUAL-01 | Real Freighter/Testnet smoke | `deployment/freighter-smoke.md` | QA | Pending |
| CLOSE-01 | Known limitations and moved P1 items | `closure.md` | Product | Pending |

Paths are created only when safe evidence exists. Every artifact records date, commit, environment, operator, result, and related defect without embedding prohibited values.

## Current state

Local automated evidence is recorded in the
[testing and evidence checklist](../../auth/testing-and-evidence.md). Manual and deployed
evidence remains **Pending**, so the current Sprint closure decision is **Not complete**.
