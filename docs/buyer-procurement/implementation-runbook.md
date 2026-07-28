# Sprint 4 implementation runbook

Status: implementation and local verification complete; authenticated QA evidence pending  
Scope authority: [Sprint 4 detailed specification](../Movix-Sprint-04-Buyer-Procurement-Detailed.md)

## Work ledger

| Work item                                      | Owner  | Status                   | Verification / authority                                                                                  |
| ---------------------------------------------- | ------ | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Readiness and deployment inventory             | Elliot | Implemented              | Empty development skeleton inventory; [data and validation](data-and-validation.md#migration)             |
| Shared domain contracts and errors             | Elliot | Implemented              | Domain tests; [data and validation](data-and-validation.md)                                               |
| Canonical schema, indexes, migration inventory | Elliot | Implemented              | Schema tests and Convex code generation                                                                   |
| Organization-derived authorization             | Elliot | Implemented              | Backend denial matrix; [API contract](api-contract.md)                                                    |
| Exact supplier resolution                      | Elliot | Implemented              | Backend self/foreign/ineligible tests                                                                     |
| Draft create and section/line commands         | Elliot | Implemented              | Backend idempotency/stale tests                                                                           |
| Buyer dashboard/list/detail                    | Elliot | Implemented              | Web typecheck and accessibility surfaces                                                                  |
| Five-section create/review and autosave        | Elliot | Implemented              | Web typecheck; [architecture](architecture.md#autosave-concurrency)                                       |
| Atomic send and immutable revision             | Elliot | Implemented              | Backend replay/side-effect/immutability tests                                                             |
| Versioned cancellation                         | Elliot | Implemented              | Backend eligible/foreign/replay tests                                                                     |
| S4-11 URL list context                         | Elliot | Implemented              | Status/asset/date filters use URL parameters                                                              |
| Documentation suite and evidence manifest      | Bri    | Implemented              | This directory and evidence manifest                                                                      |
| Repository test/build/type/lint/format gates   | Elliot | Verified                 | Local commands green                                                                                      |
| Dedicated authenticated Playwright journeys    | QA     | Pending external fixture | Requires test deployment/session seed; registry exists in [testing and evidence](testing-and-evidence.md) |

“Implemented” means code exists and has linked verification; it does not imply production release approval. The release decision remains pending until the closure commands and dedicated authenticated browser evidence are green.

## Ordered execution and gates

1. Domain contracts and schema: complete.
2. Authorization, supplier resolution, and draft mutations: complete.
3. Create/review experience and autosave: complete.
4. Send/cancel atomicity: complete.
5. Dashboard/list/detail/shell: complete.
6. Documentation and local quality gates: complete.
7. Dedicated-deployment browser evidence and release sign-off: pending QA environment.

## Operating the implementation

- Generate Convex bindings after schema/API changes: `pnpm --filter @repo/backend exec convex codegen`.
- Run domain/backend/web tests before review.
- Use `migrations.sprint4OrderInventory` to confirm target state before any non-development rollout.
- Do not run a backfill until an operator has classified every non-canonical row as derivable or unresolved.
- Keep S4-11 if P0 remains green; it is isolated to URL-backed list state and can be removed without data migration.

## Deviations and decisions

- Development inventory selected direct schema replacement. Other environments are explicitly unclassified.
- Draft refresh recovery uses an opaque order ID in the URL; the server remains authoritative.
- Supplier notifications target the supplier organization, not an arbitrary member.
- No ADR was required: implementation did not alter a fixed Sprint 4 rule.
- Sprint 3 organization sign-offs remain a release dependency but are not a runtime dependency.

## Blockers and handoff

The repository cannot manufacture authenticated Playwright evidence without a dedicated Convex test deployment and deterministic test identities/wallet sessions. QA must provide that fixture, run the journeys below, redact outputs, and attach immutable evidence before release approval.
