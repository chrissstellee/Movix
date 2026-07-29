# Sprint 5 Implementation Runbook

## Work ledger

| Story | Implemented surface | Local status | Release status |
|---|---|---|---|
| S5-01 | Supplier summary, exact counts, indexed queue, dashboard/list states | Implemented and unit/component tested | QA evidence pending |
| S5-02 | Separate supplier allowlist and frozen review UI | Implemented and privacy tested | Authenticated browser evidence pending |
| S5-03 | Atomic acceptance, receipt replay, funding eligibility | Implemented and backend tested | Race matrix expansion and QA pending |
| S5-04 | Structured rejection and redaction | Implemented and backend tested | Full reason/Unicode matrix pending |
| S5-05 | Buyer organization notifications and deep links | Implemented and backend tested | Authenticated deep-link evidence pending |
| S5-06 | Version/revision/hash/deadline guards and retry-safe expiry | Implemented; representative denial/expiry tests green | Full material-race registry pending |
| S5-07 | Accepted/rejected + unfunded revision N+1 clone | Implemented and accepted-path tested | Rejected/full re-acceptance browser evidence pending |
| S5-08 | Paginated revision groups and deterministic event order | Implemented and backend/component tested | Buyer/supplier parity evidence pending |

## Ordered gates

1. Domain lifecycle, rejection normalization, and eligibility tests.
2. Backend schema/typecheck and Sprint 4 regression.
3. Supplier authorization/projection privacy tests.
4. Atomic decision, deadline, notification, count, revision, and history tests.
5. Web typecheck/component/accessibility tests.
6. Migration dry-run, deployment inventory, and count reconciliation.
7. Authenticated Playwright journeys and immutable evidence capture.
8. Lint, format, build, E2E, contract, and Stellar regression gates.
9. Product, QA, Security, and release sign-off.

## Deployment procedure

1. Create a deployment-specific evidence directory and record commit, Convex deployment, environment, and operator.
2. Deploy the widen schema with Sprint 5 feature exposure disabled.
3. Run paginated inventory. Stop on any missing/orphan immutable identity.
4. Run migration dry-run and save output.
5. Execute the resumable backfill.
6. Reconcile every supplier count.
7. Activate index-backed APIs, then the UI.
8. Seed deterministic buyer, supplier, foreign, expired, stale, XLM, USDC, accepted, rejected, and revised QA fixtures.
9. Generate buyer/supplier/foreign authenticated storage states.
10. Run all gates and attach immutable artifacts.

## Deviations and decisions

- The requested long composite-index name exceeded Convex’s 64-character limit. The implementation uses `by_supplier_queue_sortTimestamp` with the same ordered fields.
- Rejected-order revision recovery is P0. The stale P1 line in the detailed plan is struck through and recorded as an approved erratum.
- Cloud-backed Convex code generation was not used after its retry was blocked for external-upload risk. Local generated types already reflect the new modules; a trusted deployment operator must run deployment codegen during the controlled rollout.
- Sprint 4 authenticated Playwright, responsive, security, and release evidence remains incomplete and is not reported closed.

## Current blockers

- No target deployment inventory or migration authorization.
- No authenticated QA deployment and deterministic storage-state manifest.
- No immutable Sprint 5 browser/security evidence.
- Full P0 denial/race/re-acceptance test matrix is not yet proven.

These blockers prevent release closure, not local unit/integration development.
