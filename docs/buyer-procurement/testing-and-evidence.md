# Sprint 4 testing and evidence

Status: repository gates green; authenticated browser release evidence pending  
Scope authority: [Sprint 4 detailed specification](../Movix-Sprint-04-Buyer-Procurement-Detailed.md)

Acceptance wording stays in the detailed specification. This document maps S4-01–S4-11 to implementation evidence without copying its criteria.

## Acceptance registry

| Story                | Evidence owner | Automated coverage                                                                                                                         |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S4-01 dashboard      | Elliot / QA    | Backend exact counts; buyer dashboard a11y test                                                                                            |
| S4-02 list           | Elliot / QA    | Indexed pagination backend test; responsive list a11y test                                                                                 |
| S4-03 supplier       | Elliot         | Exact target, self-dealing, foreign/ineligible backend matrix                                                                              |
| S4-04 header         | Elliot         | Snapshot, PO uniqueness, stale/ownership backend coverage                                                                                  |
| S4-05 items          | Elliot         | Line arithmetic, ownership, limit, edit/remove/reorder code paths                                                                          |
| S4-06 totals         | Elliot         | Domain rounding/overflow/XLM/USDC tests; send recomputation                                                                                |
| S4-07 draft/recovery | Elliot / QA    | Create replay/stale tests; serialized web queue; URL refresh identity                                                                      |
| S4-08 review         | Elliot / QA    | Backend-authoritative projection of fields collected by the five-step flow; grouped UI; buyer-only note distinction; blockers/hash preview |
| S4-09 send           | Elliot         | Concurrent/replay, frozen mutation denial, exact side effects                                                                              |
| S4-10 detail/cancel  | Elliot         | Authorized detail and eligible/foreign/replay cancel tests                                                                                 |
| S4-11 list context   | QA             | URL-backed filter implementation; browser back journey pending                                                                             |

## Required matrices

Unit and Convex tests cover exact arithmetic, half-up rounding, XLM/USDC formatting, normalization, canonical ordering, internal-note exclusion, int64 overflow, role/tenant denial, self-supplier denial, idempotent create/send/cancel, stale writes, incomplete send, total recomputation, frozen revision denial, and side-effect counts.

The dedicated browser run must execute the detailed specification’s fourteen journeys:

1. Buyer first-use dashboard to create.
2. Create XLM order with two lines.
3. Create USDC order with two lines.
4. Exact supplier resolve and self-dealing denial.
5. Manual save, autosave, and refresh recovery.
6. Two-tab stale write and reload-latest recovery.
7. Duplicate buyer PO race.
8. Review blockers and first-invalid-field focus.
9. Send, duplicate send, and immutable snapshot.
10. Draft cancellation.
11. Sent/unfunded cancellation.
12. Unknown/foreign safe denial.
13. Keyboard, live region, 320 px, tablet, and desktop layouts.
14. Expired session during edit with safe recovery.

S4-11 browser-back preservation is additionally required when treated as shipped scope.

## Quality commands

```text
pnpm --filter @repo/domain test
pnpm --filter @repo/backend test
pnpm --filter web test
pnpm test:a11y
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test:e2e
pnpm test:contracts
pnpm --filter @repo/stellar test
```

Use fictional deterministic organizations and redacted wallet labels. Contract and Stellar package gates prove regression only: Sprint 4 must not invoke them.

## Evidence requirements

Evidence lives under [Sprint 4 evidence](../evidence/sprint-04/README.md). Each artifact records command/environment, commit SHA, timestamp, result, owner, relevant story/AC IDs, and redaction review. Required evidence includes:

- target inventory and schema/codegen;
- domain golden vectors and overflow;
- authorization and safe denial matrix;
- stale/replay/concurrency results;
- frozen revision and exact side-effect counts;
- cancel eligibility matrix;
- axe and keyboard/focus outcomes;
- 320 px/tablet/desktop screenshots;
- fourteen authenticated Playwright traces/report;
- contract and Stellar regression outputs;
- final security review and release decision.

## Current closure status

The latest full regression is green: domain 20, Stellar 54, backend 29, and web 52
tests passed (155 total). Backend/web typechecks passed; the production build
compiled, typechecked, and generated routes; lint passed. This covers the expanded
review projection and its grouped presentation. The format gate remains pending
because active Convex code generation rewrites three generated declaration files
during the check.
These results do not constitute manual responsive, screenshot, screen-reader, or
authenticated Playwright evidence; those release artifacts remain pending.
