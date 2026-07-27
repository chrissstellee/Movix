# Sprint 2 Business Onboarding Implementation Runbook

This is the living engineering ledger for the P0 Sprint 2 scope. The canonical product and acceptance wording remains in the [detailed Sprint 2 specification](../Movix-Sprint-02-Business-Onboarding-Detailed.md).

## Delivery status

| Epic                             | Stories     | Implementation                                                                                                                    | Verification                                                                            |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Establish an authorized business | S2-01–S2-06 | Domain rules, widened schema, draft APIs, atomic completion, owner membership, audit, and tenant authorization implemented        | Focused domain and Convex tests pass; deployment inventory and release evidence pending |
| Enter the Movix workspace        | S2-07       | Server context, route policy, buyer/supplier routes, responsive navigation, wallet indicator, and invalidation guards implemented | Unit/type/lint/build and manual responsive evidence pending final gate                  |
| Maintain a ready profile         | S2-08–S2-09 | Versioned profile/contact/address APIs, section forms, server readiness, and safe audits implemented                              | Focused Convex coverage present; full browser and accessibility evidence pending        |

S2-10, autosave, analytics, and persisted view preference are deferred.

## Execution ledger

| Order | Work item                                                          | Dependency                | Owner  | Status                    | Evidence                                     |
| ----- | ------------------------------------------------------------------ | ------------------------- | ------ | ------------------------- | -------------------------------------------- |
| 1     | Shared constants, ISO registry, normalization, PH rules, readiness | Sprint 1 domain baseline  | Elliot | Implemented               | `packages/domain/src/business.test.ts`       |
| 2     | Widened Convex schema and resumable migrations                     | Persistent-data inventory | Elliot | Implemented; not executed | `packages/backend/convex/migrations.ts`      |
| 3     | Reusable identity, membership, role, capability helpers            | Sprint 1 auth             | Elliot | Implemented               | backend authorization tests                  |
| 4     | Draft query/save/resume/concurrency                                | 1–3                       | Elliot | Implemented               | `onboarding.test.ts`                         |
| 5     | Atomic idempotent completion                                       | 4                         | Elliot | Implemented               | `onboarding.test.ts`                         |
| 6     | Current context, settings, readiness, wallet query                 | 3–5                       | Elliot | Implemented               | `organizations.test.ts`                      |
| 7     | Five-step onboarding experience                                    | 4–5                       | Elliot | Implemented               | full UI evidence pending                     |
| 8     | Organization-aware shell and settings                              | 6                         | Elliot | Implemented               | route-policy tests; full UI evidence pending |
| 9     | Documentation, terminology, and drift review                       | all                       | Bri    | Current                   | this documentation set                       |

## Release gates and blockers

- Sprint 1 Convex, Freighter, cookie, cross-tab, and privacy evidence remains a hard Sprint 2 release gate.
- Inventory every target Convex deployment before selecting direct canonicalization or widen-migrate-narrow.
- Product approval is still required for attestation wording and Philippine address rules.
- The 13 dedicated-deployment Playwright journeys, assistive-technology smoke tests, and safe evidence manifest must be completed before closure.
- No production migration or deployment is authorized by this runbook.

## Change discipline

Technical contract changes require a same-change update to the API, data, security, and testing documents. Evidence entries must identify an immutable commit, environment, operator, result, defect, and safe artifact identifier. Live PII and credentials are prohibited.
