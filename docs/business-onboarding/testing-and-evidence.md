# Sprint 2 Testing and Evidence

## Current automated result

The implementation adds domain validation/readiness tests, Convex
draft/completion/authorization/concurrency tests, and web route-policy and
presentation tests. The latest full regression passed 155 tests: domain 20, Stellar
54, backend 29, and web 52. Backend/web typechecks, production build, and lint
passed. The format gate remains pending while active Convex code generation
rewrites generated declarations. Browser evidence remains required before
Sprint 2 can be marked complete.

## Acceptance identifier registry

Existing acceptance bullets retain their exact wording in the detailed specification. Their immutable ID is the story ID plus one-based bullet order:

| Story | IDs                   | Owner             | Current verification                                      |
| ----- | --------------------- | ----------------- | --------------------------------------------------------- |
| S2-01 | S2-01-AC01…S2-01-AC09 | Elliot / QA       | Backend implementation; closure evidence pending          |
| S2-02 | S2-02-AC01…S2-02-AC08 | Elliot / QA       | Domain and backend tests; UI evidence pending             |
| S2-03 | S2-03-AC01…S2-03-AC08 | Elliot / QA       | Backend tests; UI evidence pending                        |
| S2-04 | S2-04-AC01…S2-04-AC08 | Elliot / QA       | Draft tests; cross-tab browser evidence pending           |
| S2-05 | S2-05-AC01…S2-05-AC07 | Elliot / Security | Atomicity/idempotency tests; release evidence pending     |
| S2-06 | S2-06-AC01…S2-06-AC08 | Elliot / Security | Authorization tests; complete matrix pending              |
| S2-07 | S2-07-AC01…S2-07-AC09 | Elliot / QA       | Route-policy test; responsive/a11y evidence pending       |
| S2-08 | S2-08-AC01…S2-08-AC09 | Elliot / QA       | Backend concurrency/audit tests; browser evidence pending |
| S2-09 | S2-09-AC01…S2-09-AC06 | Elliot / Product  | Domain/backend tests; wording sign-off pending            |

The implementation and test anchors are `packages/domain/src/business.ts`, `packages/backend/convex/onboarding.ts`, `packages/backend/convex/organizations.ts`, and `apps/web/features`. Evidence records map the individual IDs to immutable artifact IDs at verification time.

## Authorization matrix

Each public function must cover unauthenticated, inactive user/session, no membership, active owner, inactive membership, inactive organization, multiple active memberships, and foreign organization/child identifiers as applicable. Results must prove allow/deny behavior without recording foreign data.

## UI and accessibility matrix

Cover loading, saving, reviewing, completing, stale, retry, access-denied, and
redirect states; error focus/live regions; review attestation; native-select option
contrast and 12 px label/control spacing; buyer/supplier/dual shells; expanded and
collapsed desktop icon navigation with accessible names; unchanged mobile
navigation focus restoration; tab keyboard behavior and responsive overflow in
business settings; edit/cancel/stale settings; wallet display; and logout.

Verify at 320px, tablet, desktop, 200% zoom, keyboard only, screen-reader smoke, reduced motion, focus restoration, and no horizontal scrolling. `test:a11y` must include onboarding, shell, and settings before closure.

Automated coverage does not replace manual contrast, responsive, zoom,
screen-reader, or screenshot evidence.

## Required browser evidence

Run all 13 journeys from the detailed plan against a dedicated test Convex deployment with deterministic seeded identities. Browser-only authorization mocks and production are prohibited.

Each evidence record includes scenario/AC IDs, immutable commit, safe environment label, operator, result, linked defect, and artifact ID. Follow [the evidence manifest](../evidence/sprint-02/README.md).

## Closure commands

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

Closure also requires complete safe evidence, zero open P0 defects, product/security/QA/DevOps sign-offs, and the Sprint 1 release gate.
