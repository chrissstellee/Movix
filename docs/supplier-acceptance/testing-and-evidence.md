# Supplier Acceptance Testing and Evidence

## Traceability rule

Every closure claim must resolve:

```text
Story → AC ID → test ID → evidence entry → immutable artifact
```

The 48 stable AC IDs live in the [detailed plan](../Movix-Sprint-05-Supplier-Acceptance-Detailed.md). Evidence IDs are reserved in the [manifest](../evidence/sprint-05/README.md).

## AC-to-test registry

| Story / AC range | Automated test IDs | Primary evidence |
|---|---|---|
| S5-01-AC01..06 | BE-S5-QUEUE-01, WEB-S5-DASH-01, S5-E2E-01..02 | S5-EV-BE-01, S5-EV-WEB-01, S5-EV-E2E-01 |
| S5-02-AC01..06 | BE-S5-PROJECTION-01, WEB-S5-REVIEW-01, S5-E2E-03..04,14 | S5-EV-BE-02, S5-EV-A11Y-01, S5-EV-E2E-02 |
| S5-03-AC01..06 | DOMAIN-S5-ELIGIBILITY-01, BE-S5-ACCEPT-01, S5-E2E-05,08 | S5-EV-DOMAIN-01, S5-EV-BE-03, S5-EV-E2E-03 |
| S5-04-AC01..06 | DOMAIN-S5-REASON-01, BE-S5-REJECT-01, S5-E2E-06 | S5-EV-DOMAIN-02, S5-EV-BE-04, S5-EV-E2E-04 |
| S5-05-AC01..06 | BE-S5-NOTIFY-01, S5-E2E-07,13 | S5-EV-BE-05, S5-EV-E2E-05 |
| S5-06-AC01..05 | BE-S5-EXPIRY-01, BE-S5-GUARDS-01, S5-E2E-11..13 | S5-EV-BE-06, S5-EV-E2E-06 |
| S5-07-AC01..07 | BE-S5-REVISION-01, S5-E2E-09..10 | S5-EV-BE-07, S5-EV-E2E-07 |
| S5-08-AC01..06 | BE-S5-TIMELINE-01, WEB-S5-HISTORY-01, S5-E2E-10,14 | S5-EV-BE-08, S5-EV-A11Y-02, S5-EV-E2E-08 |

Registry entries identify intended coverage families. Release evidence must link each individual AC to a concrete assertion before closure.

## Current automated coverage

- Domain: lifecycle transitions, six rejection reasons, note normalization, and funding-eligibility truth cases.
- Backend: schema inserts/references, supplier counts/list, supplier allowlist denylist, accept/replay, reject/redaction, buyer notification/read, expiry idempotency, accepted revision clone, and deterministic history.
- Web: supplier dashboard/review/dialog semantics and axe; Sprint 5 is explicit in `pnpm test:a11y`.
- Playwright: 14 authenticated journeys are defined in `e2e/sprint5.spec.ts`.

## Required fixture matrix

Buyer, supplier owner/admin/procurement/operations, supplier finance/viewer, buyer-only, dual-role, foreign supplier, suspended user/membership, unverified supplier, paused relationship, expired, stale version, stale hash, cancelled, already decided, accepted/rejected unfunded, non-unfunded, XLM, and USDC.

## Required race matrix

- accept vs accept
- reject vs reject
- accept vs reject
- decision vs cancellation
- decision vs expiry
- decision vs revision start
- revision start vs revision start
- expiry retry after accept/reject/cancel/supersession

For every losing command, compare before/after decisions, receipts, notifications, audits, counts, revisions, and lines.

## Browser and accessibility evidence

The authenticated suite requires `MOVIX_E2E_BASE_URL` and `MOVIX_E2E_SPRINT5_FIXTURES`. The manifest names buyer, supplier, and foreign storage-state files plus deterministic order IDs. Missing inputs throw `SPRINT5_RELEASE_BLOCKED`; tests are never silently skipped.

Capture desktop and 320 px screenshots, keyboard dialog focus/return, live-region pending/success/error, long names/notes/hashes, reduced motion, screen-reader ordered history, session expiry, stale reload, and axe results.

## Closure

Sprint 5 closes only when all 48 P0 ACs map to green evidence, migration reconciliation is exact, authenticated E2E is green, Security signs redaction/isolation, and QA signs browser/accessibility results. Local green tests alone are insufficient.
