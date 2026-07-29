# Movix Sprint 6 — ASEAN Agricultural Trade Pivot and Release Readiness

> Status: Engineering implementation complete in development; release sign-off pending  
> Duration: 2 weeks  
> Preserves: Completed Sprint 0–5 implementation and evidence  
> Defers: Escrow funding integration to Sprint 7

## Sprint goal

Convert the working generic procurement flow into a verified Importer–Exporter Trade Order flow without breaking historical records, accepted revisions, deep links, API consumers, or escrow v1 compatibility.

## Demo

Two distinct authenticated QA organizations complete verification. An Importer creates a complete agricultural Trade Order, invites the intended Exporter, obtains acceptance of the exact v2 revision, makes a material edit, and obtains re-acceptance. Trade Document metadata and access controls are demonstrated. Migration counts reconcile, legacy records remain readable, and escrow v1 regression stays green without an ABI change.

## Current closure state

The Sprint 6 application, domain, backend, migration, compatibility, and contract-adapter work is implemented. The widened backend and functions were deployed to the Convex development deployment on July 29, 2026 at 18:54 Asia/Manila. Local automated verification and development migration reconciliation are recorded in [Sprint 6 release evidence](./evidence/sprint-06/README.md).

Engineering completion is not release sign-off. The following remain blocking:

- authenticated two-organization Sprint 6 Playwright execution;
- manual keyboard, screen-reader, responsive, and error-state review;
- Testnet transaction projection and smoke evidence using approved identities;
- scanner and retention operations proof;
- security and privacy review;
- named pilot-decision approvals;
- rollback rehearsal; and
- human release sign-offs.

The escrow contract source, ABI, WASM, and generated bindings did not change. Contract release verification passed against the existing approved artifact, so Sprint 6 required no contract deployment.

## Committed backlog

| ID | Priority | Story | Acceptance summary |
|---|---|---|---|
| S6-01 | P0 | Publish the pivot addendum and compatibility glossary | Current scope, terminology, non-goals, document authority, and preserved history are unambiguous |
| S6-02 | P0 | Apply agricultural terminology to active UI and docs | No active flow mixes legacy and current user-facing terms; historical text remains intact |
| S6-03 | P0 | Complete organization verification | Verification is explicit, auditable, server-enforced, and gates consequential actions |
| S6-04 | P0 | Complete intended Exporter invitation/onboarding | Expired, revoked, reused, wrong-org, and duplicate cases are deterministic |
| S6-05 | P0 | Extend revisions with agricultural Trade Order fields | Commodity, exact quantity/UOM, origin/destination, shipment/arrival windows, and optional Incoterm/place validate |
| S6-06 | P0 | Add `order-terms-v2` and material-amendment rules | V1 hashes stay unchanged; material edits require a new revision and Exporter re-acceptance |
| S6-07 | P0 | Add independent Shipment and versioned Trade Document foundations | State ownership, access control, digests, history, and evidence manifests are testable |
| S6-08 | P0 | Widen and migrate Convex data additively | IDs, ownership, status, timestamps, hashes, and audit history are preserved and counts reconcile |
| S6-09 | P0 | Preserve API, route, and escrow compatibility | Legacy calls/deep links work; canonical aliases delegate; escrow v1 ABI/WASM is unchanged |
| S6-10 | P0 | Close pivot release-readiness gaps | QA fixtures, E2E, accessibility, concurrency, security, re-acceptance, and migration evidence pass |
| S6-11 | P1 | Record pilot-corridor decision inputs | Commodity/UOM, document, legal, asset, verification, dispute, and retention assumptions have owners |

## Acceptance criteria

### Product and UX

- Active navigation, titles, forms, notifications, errors, metadata, dialogs, and accessible names use Importer, Exporter, Trade Order, Trade Agreement, Shipment Status, and Delivery Confirmation.
- Existing `/buyer`, `/supplier`, and `/orders` deep links continue to work.
- The landing page does not imply counterparty or commodity discovery.
- Verification states are not started, pending, verified, and action required; every blocked action explains recovery.
- Trade Agreement, Escrow, Shipment, and Trade Document states remain visually and semantically separate.

### Domain and migration

- New Trade Orders require exact commodity quantity/UOM, origin/destination, shipment/arrival windows, and all selected Incoterm data.
- Material edits include counterparty, commodity/specification, quantity/UOM, price/asset, route, Incoterm/place, dates, and required commercial documents.
- A material edit invalidates funding eligibility until the exact new revision is accepted.
- Pre-pivot drafts that cannot be completed from stored facts are `legacy_incomplete`; no missing fact or verification is fabricated.
- Completed, cancelled, funded, or in-flight v1 records retain their IDs, terms hashes, history, and permitted behavior.
- Migration dry-run and applied counts reconcile exactly; a second run produces no additional mutations.

### Documents and security

- Document versions are append-only and carry digest, type, uploader/issuer, timestamps, visibility, and scan state.
- Only authorized Importer/Exporter organizations can enumerate or request document access.
- Shipment and delivery evidence manifests bind order, revision, escrow, network, and exact document-version digests.
- Uploading an operational shipment document does not create a commercial revision unless it was committed as an exact commercial term.

### Architecture and contract

- Agricultural data and confidential document bytes are not stored on-chain.
- Application terminology maps to the existing `buyer`, `supplier`, and hash fields through an adapter.
- Contract `accept` is presented as funded-escrow activation, distinct from off-chain Trade Agreement acceptance.
- Escrow v1 ABI, WASM, liabilities, solvency, authorization, refund, cancellation, and lifecycle regression remain unchanged and green.

### Release readiness

- Two distinct authenticated QA accounts complete verification, invitation, Trade Order creation, acceptance, material revision, and re-acceptance.
- Playwright, keyboard/screen-reader, tenant-isolation, stale acceptance, race, security, migration, and regression evidence exists.
- Organization verification, migration reconciliation, QA environment/fixtures, accessibility, security, and release sign-off remain blocking gates rather than skipped checks.

## Dependencies

- approved pilot commodities, UOM codes, and Incoterms edition;
- pilot corridor policy and settlement-asset decision;
- organization-verification evidence and operator process;
- private document storage, malware scanning, and retention policy;
- two-party QA environment, wallets, and deterministic fixtures;
- documented dispute/refund deadlock policy; and
- migration inventory for every target deployment.

## Exit gate

- A verified Importer and verified Exporter can complete the off-chain Trade Agreement journey in QA.
- Material amendments always require re-acceptance.
- Every record and count migrates or appears in an actionable failure report; nothing is silently dropped.
- Existing Sprint 0–5 evidence and escrow behavior remain intact.
- No open P0 or P1 release defect remains for the Sprint 6 scope.

## Not in Sprint 6

- escrow funding UI/integration;
- contract redesign or redeployment;
- partial shipments/releases;
- customs, logistics, inspection, or certificate verification integrations;
- marketplace discovery;
- destructive removal of legacy APIs, routes, roles, fields, tables, or code names.
