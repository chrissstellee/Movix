# Sprint 6 Release Evidence

> Scope: ASEAN agricultural Trade Order pivot  
> Evidence date: July 29, 2026  
> Engineering state: Complete in the development deployment  
> Release state: Pending authenticated QA, operational proof, review, rehearsal, and human sign-off  
> Rule: A missing artifact is a failed gate, not an implied pass.

## Evidence handling

Store only redacted, non-production evidence in this directory. Do not commit:

- invitation tokens;
- cookies, access tokens, session-family IDs, secrets, or private keys;
- live business evidence references;
- full wallet or tenant identifiers from production;
- Trade Document bytes, signed download URLs, or storage IDs;
- raw production database exports; or
- unredacted browser, server, audit, RPC, or migration logs.

Prefer counts, stable error codes, hashes, redacted fixture identifiers, and command summaries. Every artifact must name the environment, command or procedure, result, date, and reviewer.

## Current local evidence

The following commands were run against the July 29, 2026 working tree:

| Gate | Command | Result |
|---|---|---|
| Domain behavior | `pnpm --filter @repo/domain test` | Pass: 3 files, 27 tests |
| Backend behavior | `pnpm --filter @repo/backend test` | Pass: 10 files, 51 tests |
| Stellar TypeScript behavior | `pnpm --filter @repo/stellar test` | Pass: 7 files, 56 tests |
| Web behavior and automated accessibility | `pnpm --filter web test` | Pass: 18 files, 61 tests |
| Domain type safety | `pnpm --filter @repo/domain typecheck` | Pass |
| Backend type safety | `pnpm --filter @repo/backend typecheck` | Pass |
| Stellar TypeScript type safety | `pnpm --filter @repo/stellar typecheck` | Pass |
| Web type safety | `pnpm --filter web typecheck` | Pass |
| Production build | `pnpm build` | Pass; all legacy and canonical alias routes generated |
| Repository formatting | `pnpm format:check` | Pass |
| Repository lint | `pnpm lint` | Pass; one pre-existing UI-package warning |
| Playwright foundation execution | Foundation Playwright project | Pass: 4 of 4 tests |
| Playwright collection | `pnpm exec playwright test --list` | Pass: 27 tests collected, including 9 Sprint 6 tests; authenticated fixture identities not configured for execution |
| Escrow-v1 regression | `pnpm test:contracts` | Pass: 20 tests |
| Contract release verification | `pnpm contracts:verify-release` | Pass: approved source, WASM, bindings, ABI, and contract identity match |

The focused backend suite covers:

- verification submission, internal review, audit identity, and stale-review rejection;
- single-use intended Exporter invitations, including duplicate, wrong-organization, revoked, expired, and reused outcomes;
- v2 agricultural hashing and material revision N+1 re-acceptance;
- material date, unit-price, discount, tax, calculated-line, and total commitments;
- idempotent v1/`legacy_incomplete` backfill, preview, and orphan-failure behavior;
- Trade Document storage-digest normalization, side visibility, immutable replacement, clean-only access, review/audit lifecycle, and stale replacement concurrency; and
- Shipment exact accepted-revision and escrow binding, server-recomputed evidence manifests, role ownership, legal transitions, and stale transition concurrency.

The focused Stellar suite covers evidence-manifest canonicalization, identity binding, deterministic digest ordering, and rejection of duplicate or replay-ambiguous document digests.

## Release gate checklist

`Pass` requires a reproducible artifact or reviewer entry. `Pending` remains release blocking.

| Gate | Required evidence | Status |
|---|---|---|
| Domain/backend/Stellar unit suites | Command summaries above | Pass |
| Backend and shared-package type safety | Command summaries above | Pass |
| Escrow-v1 invariant regression | Rust command summary above | Pass |
| Contract source/ABI/WASM/binding compatibility | Release verifier and approved artifact identities | Pass: unchanged approved artifacts; no deployment required |
| Web typecheck and unit regression | `pnpm --filter web typecheck` and `pnpm --filter web test` | Pass: 18 files, 61 tests |
| Keyboard and screen-reader checks | Automated a11y suite plus manual keyboard/screen-reader notes | Partial: automated axe coverage passes; manual review pending |
| Responsive/error-state checks | Narrow and wide viewport evidence for creation, verification, invitation, and detail | Pending |
| Authenticated two-party E2E | Two distinct verified organizations complete invite → v2 issue → accept → revise → re-accept | Pending |
| Fail-closed E2E | Unverified, wrong-org, stale revision/hash/version, reused token, and foreign document access | Pending |
| Trade Document lifecycle | Upload metadata match, pending scan denial, clean download, replacement history, counterparty review | Partial: local automated lifecycle/concurrency passes; authenticated scanner journey pending |
| Shipment lifecycle | Exporter transitions, evidence-bound ship, Importer-only delivery confirmation, illegal transition denial | Partial: local automated role/identity/manifest/concurrency passes; authenticated journey pending |
| Concurrency | Edit/issue, accept/reject, document replacement, Shipment transition, and migration rerun races | Pass in local automated backend suite; authenticated stress evidence remains pending |
| Migration inventory and reconciliation | Before/dry-run/after/second-pass counts for the target deployment | Pass for development deployment; repeat for every later release target |
| Testnet settlement projection | Current deployed contract ID/WASM hash, accepted-revision binding, events/getters reconciliation | Pending |
| Scanner and retention operations | Scanner identity/version, malicious fixture, retention schedule, legal hold, and deletion runbook | Pending |
| Security/privacy review | Tenant isolation, signed-URL handling, redacted logging, token/storage incident procedures | Pending |
| Pilot decision approvals | Named people, approval dates, effective versions, and linked closure evidence | Pending |
| Rollback rehearsal | Timed, reviewed recovery exercise using the widened compatibility model | Pending |
| Product/legal/operations sign-off | Named owners and dated approval | Pending |

## Authenticated QA journey

Use two distinct Testnet wallets and two distinct QA organizations. Never reuse one organization for both sides.

1. Create or reset an Importer-capable QA organization and an Exporter-capable QA organization.
2. Submit redacted verification evidence for each.
3. Use the internal operator workflow to mark both `verified`; capture case/audit counts, not raw evidence.
4. As the Importer, issue a targeted invitation.
5. Confirm deterministic denial for a wrong Exporter, then accept once as the intended Exporter.
6. Confirm reuse fails and the exact Importer–Exporter relationship is active.
7. Create an `order-terms-v2` Trade Order with:
   - an agricultural commodity;
   - exact decimal quantity and controlled UOM;
   - origin and destination countries;
   - shipment and arrival windows;
   - an optional complete Incoterms 2020 rule/place; and
   - at least two required document types.
8. Record the review hash, issue revision 1, and accept it as the Exporter.
9. Start revision 2, make a material quantity or route edit, and confirm revision-1 acceptance cannot authorize revision 2.
10. Record the changed hash, issue revision 2, and accept the exact new identity.
11. Upload a redacted fixture document. Confirm pending-scan download denial, internal clean promotion, authorized download, immutable replacement history, and counterparty-only review.
12. Create a Shipment as the Exporter, record legal transitions, bind exact clean document-version digests to the shipment evidence manifest, and mark shipped.
13. Confirm only the Importer can record `delivery_confirmed`, using a delivery evidence-manifest digest.
14. Reconcile the independent Trade Agreement, Escrow, Shipment Status, and Trade Document projections.

Record:

| Item | Value |
|---|---|
| Environment | |
| Build/commit | |
| Importer fixture alias | |
| Exporter fixture alias | |
| Invitation lifecycle result | |
| Revision 1 hash prefix | |
| Revision 2 hash prefix | |
| Document version/digest prefixes | |
| Shipment evidence digest prefix | |
| Delivery evidence digest prefix | |
| Testnet transaction hashes | |
| Reviewer/date | |

Use short prefixes only when full hashes could expose environment correlations.

## Fail-closed matrix

| Attempt | Expected result |
|---|---|
| Unverified Importer issues invitation or Trade Order | `ORGANIZATION_VERIFICATION_REQUIRED` |
| Unverified Exporter accepts invitation or decides revision | `ORGANIZATION_VERIFICATION_REQUIRED` |
| Duplicate active intended-Exporter invitation | `EXPORTER_INVITATION_DUPLICATE` |
| Wrong Exporter accepts targeted token | `EXPORTER_INVITATION_WRONG_ORGANIZATION` |
| Expired, revoked, or reused token | Matching stable invitation error |
| Importer invites its own organization | `SELF_DEALING_NOT_ALLOWED` |
| V2 line has missing origin, nonpositive quantity, or uncontrolled UOM | `TRADE_TERMS_INCOMPLETE` or `TRADE_TERMS_INVALID` |
| Reversed date windows or incomplete Incoterm | `TRADE_TERMS_INVALID` |
| Pre-pivot incomplete draft is issued | Blocked as `legacy_incomplete` |
| Exporter decides with stale revision ID/version/hash | Revision, stale, or terms-hash mismatch error |
| Participant changes a frozen revision | `ORDER_IMMUTABLE` |
| Foreign organization enumerates Shipment or document metadata | Safe `TRADE_DOCUMENT_FORBIDDEN` denial |
| Uploaded digest/size/MIME differs from storage metadata | `TRADE_DOCUMENT_INVALID` |
| Pending/rejected or side-invisible document is downloaded | `TRADE_DOCUMENT_FORBIDDEN` |
| Uploader reviews its own version | Denied/stale review |
| Importer creates or advances Exporter-owned Shipment state | `SHIPMENT_INVALID` |
| Exporter records Delivery Confirmation | `SHIPMENT_INVALID` |
| `shipped` or `delivery_confirmed` omits evidence digest | `SHIPMENT_INVALID` |
| Evidence manifest contains duplicate digests or ambiguous IDs | `EVIDENCE_MANIFEST_INVALID` |

## Migration evidence

### Development deployment result

Deployment time: July 29, 2026 at 18:54 Asia/Manila.

| Evidence | Result |
|---|---|
| Orders scanned/processed | 8 / 8 |
| Revisions scanned/processed | 8 / 8 |
| Legacy records tagged | 7 |
| Existing v2 records left unchanged | 1 |
| Missing current revisions | 0 |
| Orphan revisions | 0 |
| Supplier-queue backfill | 8 processed; sent order restored to `requires_decision` |
| Second runner calls | `Migration already done` |
| Post-migration preview | `wouldWrite: false` for all 8 records |

This closes migration reconciliation for the development deployment only. Repeat the same inventory and proof for every later target deployment.

### Before — next target deployment template

For every later target deployment, capture paginated `sprint6MigrationInventory` counts by:

- agreement status;
- current revision presence;
- `migrationState`;
- `termsHashVersion`; and
- actionable failure.

| Metric | Count |
|---|---:|
| Orders scanned | |
| Draft orders | |
| Non-draft orders | |
| Missing current revision | |
| Existing v1 revisions | |
| Existing v2 revisions | |
| Existing legacy-incomplete revisions | |

### Execute

Use the read-only preview queries before mutation:

```bash
pnpm --filter @repo/backend exec convex run migrations:sprint6MigrationInventory '{"paginationOpts":{"numItems":100,"cursor":null}}'
pnpm --filter @repo/backend exec convex run migrations:sprint6RevisionMigrationInventory '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Follow pagination cursors until complete. The migrations library's `dryRun` runner was not used for Sprint 6 because its result serialization hit a BigInt JSON limitation. The two inventory queries are side-effect-free and expose projected values, actionable failures, and `wouldWrite` without mutating records.

Execute only after reviewing target deployment and backup:

```bash
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:backfillSprint6Orders"}'
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:backfillSprint6OrderRevisions"}'
```

Add `--prod` only through an approved production change.

### Reconcile

For each table, prove:

```text
before = migrated + already-current + intentionally-skipped + actionable-failed
```

Then run both migrations a second time and prove zero document changes. Confirm:

- IDs, lifecycle states, existing terms hashes, decisions, and timestamps did not change;
- historical revisions read as `order-terms-v1`;
- incomplete current legacy drafts read as `legacy_incomplete`;
- no commodity, country, verification, or compliance fact was fabricated; and
- every missing-current-revision or orphan-revision case has an owner and recovery action.

| Reconciliation item | Result/artifact |
|---|---|
| Orders before/after exact | |
| Revisions before/after exact | |
| Second-pass writes | |
| Existing terms hashes unchanged | |
| Actionable failures | |
| Reviewer/date | |

## Contract and deployment evidence

Sprint 6 did **not** change:

- `contracts/` source;
- escrow ABI;
- release WASM; or
- `packages/stellar/generated/` bindings.

`packages/stellar/src/contracts.ts` adds only an application-level `activateEscrow` alias that calls the existing generated `accept` method. Because the smart contract did not change, no Soroban deployment was required for this sprint.

The release verifier matched the approved source, WASM, bindings, ABI, and Testnet contract identity. Its cleanliness check is scoped to contract release artifacts, so unrelated application/documentation changes do not create a false contract-change signal. No deployment or contract-ID rotation was required. Testnet transaction projection and smoke still require approved identities and remain pending.

| Evidence | Value |
|---|---|
| Source commit | `a9d09f9bf4890d6093803be6d1a62fe5d460a2b2` |
| Approved Testnet contract ID | `CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5` |
| Release/deployed WASM SHA-256 | `a6c938a6148a7fd0cc768eee25088ef66822243c05e71516e1400d9bc18bd498` |
| Generated bindings SHA-256 | `066d15c46562c1ca29630ae59615eb3ac6f29cd058bf7b95852ef09b43930cf8` |
| ABI compatibility result | Pass; unchanged |
| `pnpm contracts:verify-release` | Pass |
| Testnet transaction projection/smoke | Pending approved identities |
| Evidence date | July 29, 2026 |

If contract source, ABI, WASM, or generated bindings change, stop this checklist. The “no deployment required” decision no longer applies. Regenerate bindings, repeat every contract invariant and release check, deploy through `contracts:deploy:testnet`, rotate the configured contract identity as approved, and capture new proof before release.

## Rollback rehearsal

Rehearse the following without deleting data:

1. disable new v2 issuance;
2. leave widened optional fields and compatibility readers deployed;
3. resume legacy reads and existing v1 settlement;
4. correct and resume a deliberately interrupted migration from its cursor;
5. prove the second pass is idempotent;
6. revoke an exposed invitation and issue a replacement;
7. deny a compromised document version without removing its audit history; and
8. require reload/review after a stale Trade Order, document, or Shipment write.

Record the rehearsal owner, environment, start/end time, observed recovery point, and unresolved risk.

## Sign-off

| Area | Owner | Decision | Date | Artifact |
|---|---|---|---|---|
| Engineering | | Pending | | |
| QA | | Pending | | |
| Security/Privacy | | Pending | | |
| Migration/Data | | Pending | | |
| Stellar/Contract | | Pending | | |
| Product | | Pending | | |
| Legal/Operations | | Pending | | |

Sprint 6 is release-ready only when every P0/P1 defect is closed and every gate above is `Pass` with an artifact.
