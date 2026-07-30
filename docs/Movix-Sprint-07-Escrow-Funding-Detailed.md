# Movix Sprint 7 - Escrow Funding Integration and Reconciliation

> Status: Implementation-ready; external entry and release gates remain open  
> Duration: 2 weeks  
> Primary implementer: Elliot  
> Target: Stellar Testnet only  
> Primary surface: Funding section on `/orders/[orderId]` and its canonical `/trade-orders/[orderId]` alias  
> Sprint authority: [Movix Sprint Plan](./Movix-Sprint-Plan.md)  
> Product authority: [Movix ASEAN Agricultural Trade Pivot](./Movix-ASEAN-Agricultural-Trade-Pivot.md)  
> Architecture authority: [Agricultural Trade Architecture and Sprint 6 Migration](./agricultural-trade-architecture-and-migration.md)  
> Contract authority: [Escrow v1 ABI](./contracts/escrow-v1/abi.md) and [deployment manifest](../deployments/stellar/testnet/escrow-v1.json)

## 1. Sprint goal

Integrate the frozen escrow v1 contract so a verified Importer can lock the exact value of the exact accepted Trade Order revision once, and both the Importer and Exporter can see the same confirmed Stellar chain facts.

Sprint 7 proves one claim: **an accepted Trade Order can become a uniquely funded escrow without duplicate liability or application/chain ambiguity**.

This sprint does not complete fulfillment or settlement. Exporter escrow activation, shipment, Delivery Confirmation, release, and refund behavior remain later-sprint work.

## 2. Demo

Using two distinct authenticated and verified QA organizations:

1. The Importer opens an accepted 500 USDC Trade Order.
2. The funding panel shows the exact accepted revision, amount, asset, Exporter, wallets, Testnet network, verified contract, zero platform fee, deadline, and resulting state.
3. The application checks wallet account, network, balance/trustline, deployment identity, and funding eligibility.
4. The generated escrow v1 binding constructs and simulates `create_and_fund`.
5. The simulation exposes the expected Importer authorization and nested SAC transfer.
6. Freighter signs and submits the transaction.
7. Movix records the transaction hash as submitted without presenting the order as funded.
8. RPC finality plus `get_escrow` reconciliation confirms the exact on-chain state.
9. Both parties see the same confirmed funding receipt: asset, amount, network, contract, transaction hash, ledger, and accepted terms hash.
10. The demo also covers a rejected wallet prompt and refresh/browser-close recovery after submission.

## 3. Outcome and success measures

Sprint 7 is successful when:

- one accepted Trade Order produces at most one live on-chain escrow and one active liability;
- confirmed funding succeeds without staff help in at least 90% of valid pilot attempts, excluding explicit user rejection;
- no failed, pending, unknown, or mismatched transaction appears as funded;
- Importer and Exporter projections agree with the contract getter;
- unexplained contract/projection variance is zero;
- an interrupted browser session resumes tracking without creating a second transaction; and
- all P0 acceptance and evidence gates in this document pass.

## 4. Entry gates

Engineering may begin behind a testnet feature flag while Sprint 6 release evidence is completed. Sprint 7 must not be declared complete or enabled for pilot use until these gates are satisfied.

### 4.1 Sprint 6 gates

- [ ] Two distinct authenticated organizations complete verification, invitation, Trade Order creation, acceptance, material revision, and re-acceptance.
- [ ] Keyboard, screen-reader, 320px, tablet, desktop, and error-state review is recorded.
- [ ] Organization verification and consequential-action authorization are proven server-side.
- [ ] Testnet transaction projection/smoke is executed with approved identities.
- [ ] Scanner and retention operations proof is recorded.
- [ ] Security/privacy review, rollback rehearsal, pilot decisions, and named human sign-offs are complete.

### 4.2 Contract and deployment gates

- [ ] `pnpm contracts:verify-release` passes against the exact approved artifact.
- [ ] The approved deployment is `CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5`.
- [ ] The deployed contract reports version `1`.
- [ ] The fetched WASM matches SHA-256 `a6c938a6148a7fd0cc768eee25088ef66822243c05e71516e1400d9bc18bd498`.
- [ ] Generated bindings match SHA-256 `066d15c46562c1ca29630ae59615eb3ac6f29cd058bf7b95852ef09b43930cf8`.
- [ ] Network passphrase is exactly `Test SDF Network ; September 2015`.
- [ ] XLM and USDC SAC identifiers match the deployment manifest and live Testnet.
- [ ] Contract `maxFeeBps` and the pilot fee are both confirmed as zero.
- [ ] RPC, event range, retention, retry, and rate-limit assumptions are verified against the selected provider.

If any identity differs, stop funding. Do not fall back to a browser-supplied contract, asset, RPC, or network value.

## 5. Product decisions for Sprint 7

These decisions are part of the committed implementation. Elliot should not reinterpret them in code.

| Decision | Sprint 7 rule |
|---|---|
| Network | Testnet only. Mainnet is rejected fail-closed. |
| Contract | Use the single verified escrow v1 deployment from the checked-in manifest. |
| Assets | Support the allowlisted XLM SAC and one allowlisted Testnet USDC SAC. If capacity falls, complete USDC first without weakening the asset abstraction. |
| Fee | `fee_bps = 0`. No platform fee, fee sponsorship, or alternative fee path. |
| Amount | Fund the accepted revision's exact positive `grandTotalBaseUnits`; never recalculate from formatted decimals in the browser. |
| Parties | Contract `buyer` is the accepted Importer wallet snapshot; contract `supplier` is the accepted Exporter wallet snapshot. |
| Terms commitment | Convert the accepted revision's exact 64-character hex `order-terms-v2` hash to `BytesN<32>`. Do not re-hash display JSON. |
| Contract deadline | For this testnet MVP, contract `accept_by` uses the accepted revision's `fundingDeadline`, converted from milliseconds to whole Unix seconds. It must still be in the future at simulation and submission. |
| Escrow identifier | Derive one deterministic 32-byte identifier from a versioned encoding of network, verified contract ID, order ID, and accepted revision ID. Publish the encoding and golden fixtures. |
| On-chain authority | Soroban is authoritative for escrow existence, parties, token, amount, terms hash, status, ledger result, and liability. |
| Off-chain authority | Convex is authoritative for organizations, authorization, Trade Order/revision acceptance, display metadata, audit, notifications, and the reconciled projection. |
| Confirmation | A successful wallet submission is not funding confirmation. Only final transaction success plus exact getter reconciliation may set `funded`. |
| Retry | Unknown final state blocks a new funding transaction. A retry is allowed only after reconciliation proves the earlier attempt failed and no escrow exists. |
| Wallet custody | The browser wallet signs. No private key, recovery phrase, or delegated signing secret enters Movix. |
| Contract change | No escrow ABI, contract source, WASM, binding, constructor, event, or error-code change is in scope. |

### 5.1 Deadline warning

The existing `fundingDeadline` performs two jobs in Sprint 7:

- it is the last time the Importer may create and fund the escrow; and
- it becomes escrow v1 `accept_by`, before which the Exporter must perform the contract-level activation planned for Sprint 8.

The review UI must state this plainly. Funding must be disabled when the deadline is expired or too close to complete under the approved safety buffer. A separate activation deadline is a future product/schema decision and must not be invented during this sprint.

## 6. Scope

### 6.1 In scope

- verified deployment configuration and fail-closed startup/runtime validation;
- exact contract argument derivation from the accepted canonical revision;
- deterministic escrow ID derivation and golden fixtures;
- funding eligibility and organization-role authorization;
- wallet account/network verification;
- balance and USDC trustline/authorization checks;
- reusable transaction-review UI;
- `create_and_fund` simulation, signing, submission, and typed failure mapping;
- durable submission, confirmed transaction, escrow projection, and audit records;
- getter- and event-based reconciliation with a durable cursor;
- both-party confirmed funding receipt;
- refresh/browser-close recovery;
- structured operational warnings for stuck, lagging, liability, and projection mismatch states;
- unit, component, Convex, Playwright, local-ledger, contract regression, and Testnet smoke evidence.

### 6.2 Not in scope

- changing or redeploying escrow v1;
- calling contract `accept`, `mark_shipped`, `confirm_delivery`, refund, or cancellation from the product UI;
- partial funding, multiple deposits, installments, multiple escrows per accepted revision, or split payment;
- assets outside the approved XLM and USDC SACs;
- non-zero platform fees;
- sponsored transactions;
- mainnet;
- automatic release;
- customs, inspection, logistics, or certificate verification;
- database-only overrides of chain state;
- an operator action that moves pilot funds;
- full transaction-history or notification-center UI, which remains Sprint 10 scope.

## 7. Backlog traceability

The master sprint plan retains historical `S6-*` IDs for this rebaselined funding scope, while the agricultural pivot already uses `S6-*` IDs. To prevent implementation ambiguity, use `S7-F*` as the execution ID and preserve the legacy ID only as a traceability field.

| Execution ID | Legacy ID | Priority | Deliverable |
|---|---:|---:|---|
| S7-F01 | S6-01 | P0 | Verify and pin the approved deployment |
| S7-F02 | S6-02 | P0 | Derive exact funding intent and contract arguments |
| S7-F03 | S6-03 | P0 | Build funding review and readiness checks |
| S7-F04 | S6-04 | P0 | Simulate, sign, submit, and prevent duplicates |
| S7-F05 | S6-05 | P0 | Decode typed contract results, errors, and events |
| S7-F06 | S6-06 | P0 | Persist submission and reconcile finality |
| S7-F07 | S6-07 | P0 | Verify exact contract state and liability controls |
| S7-F08 | S6-08 | P0 | Show confirmed funding to both parties |
| S7-F09 | S6-09 | P0 | Recover interrupted and unknown submissions |
| S7-F10 | S6-10 | P0 | Add durable, idempotent event ingestion |
| S7-F11 | S6-11 | P1 | Add reconciliation operations signals |

## 8. Detailed stories and acceptance criteria

### S7-F01 - Verified deployment configuration

**User/system story:** As Movix, I use only a reviewed contract deployment and reviewed assets.

**Implementation**

- Add a typed deployment-manifest loader in `packages/stellar`.
- Validate schema version, network, passphrase, contract ID, contract version, artifact digest, binding digest, constructor config, and asset SACs.
- Keep private RPC credentials in server-only configuration. The public RPC URL may be exposed only if it contains no credential.
- Expose a minimal sanitized client configuration to the browser.
- Reject browser overrides for network, contract, asset, passphrase, fee, WASM, or binding identity.
- Verify `get_version` and `get_config` before enabling the funding action and cache the verified result for a short bounded interval.

**Acceptance**

- A valid checked-in manifest enables Testnet funding.
- A stale contract ID, wrong passphrase, wrong SAC, non-zero fee, binding mismatch, or fetched-WASM mismatch disables funding and raises a structured configuration error.
- The UI names the verified Testnet network and abbreviated contract ID.
- No secret or raw signed transaction is logged.

### S7-F02 - Exact funding intent and contract arguments

**User/system story:** As Movix, I derive every value-moving argument from authorized canonical records.

**Implementation**

- Add one backend operation that prepares or returns the unique funding intent for an order.
- Re-read all records inside the mutation; do not trust values copied from a prior client query.
- Require:
  - one active organization context;
  - Importer organization ownership of the order;
  - organization verification status `verified`;
  - membership capability `escrow:fund`;
  - agreement status `accepted`;
  - settlement status `unfunded`;
  - current revision equals accepted revision;
  - accepted decision references that revision and exact terms hash;
  - `order-terms-v2`;
  - distinct valid Importer and Exporter wallet snapshots;
  - positive exact `grandTotalBaseUnits`;
  - allowlisted asset metadata matching the manifest;
  - future `fundingDeadline`;
  - no confirmed or unresolved funding attempt.
- Produce immutable arguments:
  - `id`;
  - `buyer`;
  - `supplier`;
  - `token`;
  - `amount`;
  - `fee_bps = 0`;
  - `accept_by`;
  - `terms_hash`.
- Store a snapshot sufficient to prove what was presented and signed.

**Escrow ID encoding**

Use SHA-256 over the UTF-8 bytes of this exact NUL-delimited string:

```text
movix:escrow:v1\0testnet\0{verifiedContractId}\0{orderId}\0{acceptedRevisionId}
```

The 32 digest bytes are the contract `id`. Store the lowercase hex digest as `escrowKey`. Add golden fixtures proving browser, backend, and test helpers derive the same value.

**Acceptance**

- Two calls for the same order and accepted revision return the same intent and escrow key.
- A material revision and re-acceptance produces a different key.
- Client-supplied amount, token, terms hash, party, deadline, contract, or fee is ignored or rejected.
- Stale acceptance, unverified organization, unauthorized role, expired deadline, same-party wallets, unsupported asset, missing wallet snapshot, or non-positive amount fails before wallet signing.

### S7-F03 - Funding review and readiness

**User story:** As an Importer finance-authorized user, I understand the exact transaction before signing.

**Implementation**

- Create a reusable `TransactionReview` component and a Sprint 7 funding wrapper.
- Display:
  - action: Lock funds in escrow;
  - exact amount and asset with tabular numerals;
  - Trade Order number/title and accepted revision number;
  - Exporter organization and wallet;
  - connected Importer wallet;
  - Testnet label and network passphrase label;
  - verified contract ID with full-value copy/view access;
  - asset issuer and SAC where applicable;
  - fee: `0`;
  - funding/activation deadline;
  - terms hash with full-value copy/view access;
  - resulting application state: `Funding submitted`, then `Funded` only after confirmation;
  - a statement that blockchain confirms escrow funding, not delivery or document truth.
- Check wallet connection, exact wallet match, network, balance, USDC trustline/authorization, and deadline before enabling review confirmation.
- Treat balance/trustline reads as advisory readiness checks; contract simulation remains authoritative.

**Acceptance**

- The funding action is visible only to the Importer side.
- Owner, admin, and finance roles can fund; procurement, operations, and viewer roles cannot.
- Exporters can see funding status and receipts but cannot initiate Importer funding.
- Wrong account, wrong network, missing trustline, deauthorized trustline, insufficient balance, expired deadline, stale agreement, or configuration failure has specific recovery copy.
- The review works at 320px, tablet, and desktop and is complete by keyboard and screen reader.
- Money, hashes, addresses, and status never rely on gradient text or color alone.

### S7-F04 - Simulate, sign, submit, and prevent duplicates

**User story:** As an Importer, I can safely authorize one exact funding transaction.

**Implementation**

- Use the generated escrow binding through `EscrowContractClient.createAndFund`.
- Create a package-level funding orchestration adapter; do not put raw SDK construction throughout React components.
- Simulate before signing.
- Validate the simulation against the prepared intent:
  - contract and function are exact;
  - decoded arguments are exact;
  - source account is the snapshotted Importer;
  - authorization includes the Importer contract call and exact nested SAC transfer;
  - transfer destination is the verified escrow contract;
  - transfer amount and token are exact;
  - no additional value-moving authorization exists.
- Present the final review before calling Freighter.
- Allow one in-flight signing/submission request per intent.
- Submit the signed transaction once and capture the returned hash.
- Record the hash immediately as `submitted`.
- Never infer success from a successful wallet signature or RPC send response.

**Acceptance**

- Double click, rerender, route transition, and repeat mutation calls do not create parallel submissions.
- Wallet rejection leaves the Trade Order `unfunded` and creates no false transaction record.
- A signature for the wrong account or network is rejected.
- Simulation failure stops before signing.
- Failed SAC transfer leaves no escrow and no liability.
- Duplicate contract invocation cannot create a second liability.
- Raw signed XDR is not written to normal logs, analytics, notifications, or audit fields.

### S7-F05 - Typed results, errors, and events

**System story:** As Movix, I translate the frozen ABI into stable product states without a hand-maintained ABI.

**Implementation**

- Extend `packages/stellar/src/contract-errors.ts` only through typed mapping from generated error definitions.
- Extend normalized funding event support in `packages/stellar/src/events.ts`.
- Add stable application categories:
  - configuration invalid;
  - wallet disconnected;
  - wrong network;
  - user rejected;
  - unsupported asset;
  - invalid amount;
  - same party;
  - escrow exists;
  - deadline expired;
  - insufficient balance;
  - missing/deauthorized trustline;
  - simulation failed;
  - submission failed;
  - transaction failed;
  - finality delayed;
  - getter unavailable;
  - projection mismatch;
  - liability mismatch;
  - unknown/reconciliation required.
- User copy must explain a safe next action without exposing stack traces or provider internals.

**Acceptance**

- Every generated escrow error has a deterministic normalized representation.
- Raw Testnet funding event XDR decodes to the exact expected event.
- Unknown contract or RPC errors fail closed as reconciliation-required rather than funded.
- No event or error payload contains PII or commercial JSON.

### S7-F06 - Durable submission and finality reconciliation

**System story:** As Movix, I distinguish submitted, failed, unknown, and confirmed transactions.

**Implementation**

- Add idempotent backend operations to:
  - prepare the intent;
  - record the submitted hash;
  - record a terminal failure;
  - apply a confirmed reconciliation result;
  - request/resume reconciliation.
- When recording submission, atomically:
  - validate the same active intent and actor;
  - insert or reuse the transaction record;
  - set escrow and order settlement to `funding_submitted`;
  - set reconciliation to `pending`;
  - create one audit event;
  - schedule immediate reconciliation.
- Poll transaction finality with bounded exponential backoff and jitter.
- On final success, call `get_escrow` and compare every invariant before marking funded.
- On proven terminal failure with no on-chain escrow, mark the transaction failed and restore the order to `unfunded`.
- On timeout, provider ambiguity, or contradictory evidence, use `needs_reconciliation`; do not restore funding eligibility.

**Acceptance**

- Submitted state always has a valid Testnet transaction hash.
- Confirmed state always has a ledger and confirmed getter projection.
- A timeout never becomes a failed or funded result by assumption.
- Replaying the same hash or confirmed result is idempotent.
- A different hash for an unresolved intent is rejected.
- Browser closure after submission does not stop reconciliation.

### S7-F07 - Exact contract-state and liability verification

**System story:** As Movix, I prove the projection matches the exact escrow.

**Required getter comparisons**

- contract ID;
- contract version and escrow schema version;
- escrow ID;
- Importer wallet;
- Exporter wallet;
- token/SAC;
- gross amount;
- fee basis points and fee amount;
- `accept_by`;
- terms hash;
- status `Funded`;
- transaction success and ledger;
- supported-asset configuration.

**Liability controls**

- Verify the funded escrow contributes its exact gross amount to the token liability.
- Do not claim a per-escrow liability match by subtracting global totals without a consistent snapshot.
- Local-ledger tests must compare contract token balance, active escrow entries, and `get_liability`.
- Testnet operations should record a bounded liability control appropriate to the known pilot fixture set.

**Acceptance**

- Exact match sets escrow/order state to `funded` and reconciliation to `current`.
- Any mismatch sets `needs_reconciliation`/`mismatch`, records the differing field names, and raises an operations signal.
- A getter result from another contract, network, escrow ID, asset, or party can never confirm the order.
- Repair is idempotent and cannot overwrite a terminal later chain state.

### S7-F08 - Both-party confirmed funding receipt

**User story:** As either Trade Order party, I can verify confirmed escrow funding.

**Implementation**

- Extend the order-detail query with a participant-scoped escrow projection.
- Add an `Escrow funding` card separate from Trade Agreement and Shipment state.
- For confirmed funding show:
  - `Funded` status;
  - amount and asset;
  - Testnet;
  - contract ID;
  - escrow key;
  - transaction hash;
  - confirmed ledger and time;
  - Importer and Exporter wallet snapshots;
  - accepted revision and terms hash;
  - last reconciled time;
  - correct Stellar Expert Testnet links.
- For pending or mismatch states, show a warning and safe recovery path instead of a receipt.

**Acceptance**

- Both authorized organizations see the same chain facts.
- A third organization receives not-found behavior and no existence leak.
- Exporter sees `Funded` only after reconciliation.
- Full identifiers remain accessible without forcing them into narrow layouts.
- Receipt copy does not claim delivery, shipment, document validity, or legal settlement.

### S7-F09 - Interrupted funding recovery

**User story:** As an Importer, I can safely recover after refresh, browser close, disconnection, or delayed finality.

**Implementation**

- On order-detail load, query the active intent and transaction state.
- Resume reconciliation when a hash exists.
- If an intent exists without a hash:
  - check getter/event evidence for the deterministic escrow key;
  - do not assume no transaction merely because the client failed to record a hash;
  - allow the same intent to be retried only after the bounded recovery check proves no escrow and no submitted transaction evidence.
- If a confirmed event/getter exists without a recorded client hash, backfill the transaction/projection from chain evidence.
- If the wallet account or network changes during review/signing, invalidate the client attempt and require a fresh review.

**Acceptance**

- Refresh during `funding_submitted` resumes status tracking.
- Browser close immediately after send eventually produces the correct receipt through independent reconciliation.
- Unknown final state disables the funding button.
- A proven failed attempt may be retried with a new transaction record but the same deterministic escrow key.
- A late confirmation after a displayed delay updates idempotently without duplicate notifications or audit transitions.

### S7-F10 - Durable event ingestion

**System story:** As Movix, I ingest funding events exactly once and use getters to close uncertainty.

**Implementation**

- Extend the existing `reconciliationCursors` foundation.
- Add a durable event receipt table keyed by network, contract ID, transaction hash, and event index.
- Poll bounded ledger ranges and advance the cursor only after the range is durably processed.
- Decode only events from the verified contract.
- Associate a funding event through the deterministic escrow key.
- Deduplicate replayed or overlapping ranges.
- Treat event data as a trigger/evidence source; confirm material state with `get_escrow`.
- Add scheduled catch-up and an authenticated internal/manual repair entry point that does not move funds.

**Acceptance**

- Reprocessing the same range produces zero duplicate business transitions, audit records, or notifications.
- A crash between event insert and cursor advance safely replays.
- Cursor never skips a failed range.
- Unknown event variants are quarantined and alerted without corrupting the cursor or projection.
- Getter confirmation is bounded and retryable.

### S7-F11 - Operations signals

**System story:** As Operations, I can detect and investigate funding reconciliation failures.

**Signals**

- submitted transaction older than the finality threshold;
- intent without a recorded hash beyond the recovery threshold;
- event cursor lag;
- RPC/provider failures above threshold;
- deployment identity mismatch;
- getter/projection mismatch;
- liability/balance mismatch;
- repeated duplicate-attempt rejection;
- repeated wallet/network readiness failures by category, without wallet PII in analytics.

**Acceptance**

- Signals are structured, correlation-safe, Testnet-labeled, and contain order/escrow references needed for investigation.
- Signals contain no private key, session token, raw signed XDR, document contents, or unnecessary PII.
- Operations can rerun read-only reconciliation without editing financial state manually.
- A mismatch remains visible until a later successful reconciliation clears it.

## 9. Lifecycle and state rules

### 9.1 Application settlement projection

```text
unfunded
  -> funding_submitted
  -> funded

funding_submitted
  -> unfunded                 only after proven terminal failure and no escrow
  -> needs_reconciliation     when finality or evidence is unknown/mismatched
  -> funded                   only after final success plus exact getter match

needs_reconciliation
  -> unfunded                 only after proven terminal failure and no escrow
  -> funded                   only after exact getter match
```

Do not add a second "optimistic funded" state. Do not map a successful signature or submission to `funded`.

### 9.2 Contract state in this sprint

```text
none -> Funded
```

Contract `Funded -> Accepted` is not invoked by the Sprint 7 product flow. It is planned with fulfillment work in Sprint 8.

### 9.3 Invariants

- One order has at most one active escrow record.
- One accepted revision maps to one deterministic escrow key.
- One unresolved intent has at most one submitted transaction hash.
- An on-chain escrow is immutable for party, token, amount, fee, deadline, and terms hash.
- An application projection cannot be more advanced than confirmed chain state.
- A material Trade Order revision invalidates funding eligibility until the new exact revision is accepted.
- No database mutation can make an unfunded on-chain escrow appear funded.
- No operator repair can move funds.

## 10. Data model changes

Use additive schema changes. Preserve existing records and indexes.

### 10.1 Extend `escrows`

Add fields required to prove the prepared and confirmed snapshots:

- `acceptedRevisionId`;
- `termsHash`;
- `termsHashVersion`;
- `buyerWalletAddress`;
- `supplierWalletAddress`;
- `assetCode`;
- `assetIssuer`;
- `assetDecimals`;
- `feeBps`;
- `feeAmountBaseUnits`;
- `acceptBy`;
- `contractVersion`;
- `escrowSchemaVersion`;
- `wasmSha256`;
- `bindingsSha256`;
- `intentIdempotencyKey`;
- `preparedByUserId`;
- `preparedAt`;
- `submittedAt`;
- `confirmedAt`;
- `lastReconciledAt`;
- `lastReconciliationCode`;
- `mismatchFields`;
- `version`.

Fields may be optional for historical compatibility, but Sprint 7 creation and confirmation validators must require them.

Add or verify indexes for:

- unique lookup by `escrowKey`;
- order lookup;
- status/reconciliation work queues;
- submitted hash lookup where supported by the chosen schema design.

### 10.2 Extend `transactionRecords`

Add:

- `idempotencyKey`;
- `intentId`;
- `actorUserId`;
- `actorWalletAddress`;
- `contractId`;
- `assetCode`;
- `tokenContractId`;
- `amountBaseUnits`;
- `errorCode`;
- `errorCategory`;
- `lastCheckedAt`;
- `attemptCount`;
- `resultXdrHash` or an equivalent non-sensitive result digest if needed for evidence.

Store no private key, session token, wallet recovery data, or raw signed XDR.

### 10.3 Add event receipts

Add a table such as `contractEventReceipts` with:

- `network`;
- `contractId`;
- `transactionHash`;
- `ledger`;
- `eventIndex`;
- `eventType`;
- `escrowKey`;
- `payloadHash`;
- `observedAt`;
- `processedAt`;
- `processingStatus`;
- `processingErrorCode`.

Use a compound uniqueness strategy over network, contract, transaction, and event index.

### 10.4 Audit and notifications

Required audit actions:

- `escrow.funding_intent_prepared`;
- `escrow.funding_submitted`;
- `escrow.funding_failed`;
- `escrow.funding_confirmed`;
- `escrow.reconciliation_required`;
- `escrow.reconciliation_repaired`.

Create the Exporter funding notification only after confirmed funding. Notification-center presentation may remain for Sprint 10, but the record and idempotency key must exist now.

## 11. API and authorization contract

Names may be adjusted to project conventions, but responsibilities must remain separate.

| Operation | Type | Authorization | Purpose |
|---|---|---|---|
| `escrowFunding.getForOrder` | Query | Either order participant | Return participant-safe funding projection |
| `escrowFunding.prepare` | Mutation | Verified Importer + `escrow:fund` | Derive/reuse immutable funding intent |
| `escrowFunding.recordSubmission` | Mutation | Same Importer actor/intent | Atomically persist hash and submitted state |
| `escrowFunding.resume` | Mutation | Order participant or internal | Schedule idempotent reconciliation |
| `escrowReconciliation.checkTransaction` | Internal action | Internal only | Read RPC finality and getter state |
| `escrowReconciliation.applyResult` | Internal mutation | Internal only | Apply exact idempotent projection result |
| `escrowEvents.ingestRange` | Internal action | Internal only | Read verified contract events |
| `escrowEvents.applyReceipt` | Internal mutation | Internal only | Deduplicate event and trigger getter confirmation |

Every public operation must enforce organization isolation in the backend. Hiding a button is not authorization.

## 12. Suggested file-level implementation map

### Existing files to extend

- `packages/domain/src/lifecycles.ts`
- `packages/domain/src/permissions.ts`
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/validators.ts`
- `packages/backend/convex/orderDetails.ts`
- `packages/backend/convex/crons.ts`
- `packages/stellar/src/config.ts`
- `packages/stellar/src/contracts.ts`
- `packages/stellar/src/contract-errors.ts`
- `packages/stellar/src/events.ts`
- `packages/stellar/src/transactions.ts`
- `packages/stellar/src/index.ts`
- `packages/stellar/src/freighter-wallet-adapter.ts`
- `apps/web/features/orders/order-detail.tsx`
- `apps/web/app/orders/[orderId]/page.tsx`
- `apps/web/app/trade-orders/[orderId]/page.tsx`

### Likely new files

- `packages/stellar/src/deployment-manifest.ts`
- `packages/stellar/src/escrow-funding.ts`
- `packages/stellar/src/escrow-funding.test.ts`
- `packages/backend/convex/escrowFunding.ts`
- `packages/backend/convex/escrowFunding.test.ts`
- `packages/backend/convex/escrowReconciliation.ts`
- `packages/backend/convex/escrowEvents.ts`
- `apps/web/features/transactions/transaction-review.tsx`
- `apps/web/features/orders/escrow-funding-panel.tsx`
- `apps/web/features/orders/escrow-funding-panel.test.tsx`
- `apps/web/features/orders/sprint7.a11y.test.tsx`
- `apps/web/test/e2e/sprint7-funding.spec.ts` or the repository's established Playwright location
- `docs/evidence/sprint-07/README.md`

Do not duplicate canonical and compatibility route implementations. Both routes must delegate to the same order-detail and funding components.

## 13. Engineering sequence

### Phase 1 - Freeze inputs and executable specifications

1. Verify the manifest, Testnet contract, WASM, bindings, config, and SACs.
2. Add golden fixtures for escrow ID, terms hash bytes, exact amount, deadline conversion, and explorer URLs.
3. Add failing domain/Convex tests for all eligibility and authorization rules.
4. Record the deadline safety buffer and RPC finality thresholds in configuration and evidence.

### Phase 2 - Backend intent and projection

1. Apply additive schema changes.
2. Implement funding intent derivation and idempotency.
3. Extend order details with participant-safe funding projection.
4. Add audit and notification idempotency.
5. Add backend unit tests before browser submission work.

### Phase 3 - Stellar orchestration

1. Implement verified manifest loading.
2. Implement exact argument encoding and generated-binding adapter.
3. Implement simulation/auth-tree validation.
4. Implement typed results/errors and event normalization.
5. Add package tests against fixtures and the local ledger harness.

### Phase 4 - Funding UI

1. Build `TransactionReview`.
2. Build the order funding panel and state copy.
3. Integrate wallet matching, readiness checks, simulation, signature, submission, and mutation recording.
4. Cover loading, blocked, review, awaiting signature, submitting, delayed, confirmed, failed, mismatch, and resumed states.
5. Complete responsive and accessibility tests.

### Phase 5 - Reconciliation and recovery

1. Implement finality polling and exact getter comparison.
2. Implement durable event receipts and cursor processing.
3. Add scheduled catch-up.
4. Add refresh/browser-close recovery.
5. Add structured operations signals and repair evidence.

### Phase 6 - End-to-end proof

1. Run the escrow v1 regression suite unchanged.
2. Run XLM-like and USDC-like local-ledger funding.
3. Run negative and interruption paths.
4. Run authenticated two-organization Playwright.
5. Run the approved Testnet USDC demo and capture evidence.
6. Complete manual accessibility/responsive/security review and named sign-offs.

## 14. Test plan

### 14.1 Domain and unit tests

- deterministic escrow ID and golden fixtures;
- 64-character terms-hash validation and byte conversion;
- integer amount preservation for XLM and USDC;
- milliseconds-to-seconds deadline conversion without rounding up;
- expired and safety-buffer deadline rejection;
- manifest identity and digest validation;
- explorer URL construction;
- all generated contract error mappings;
- normalized funding event decoding;
- state-machine allowed and forbidden transitions;
- funding eligibility after acceptance, material revision, and re-acceptance.

### 14.2 Contract regression

- existing Rust unit, property, authorization, event, TTL, liability, race, rollback, and fuzz coverage remains green;
- zero/negative/max amount;
- unsupported asset;
- same parties;
- duplicate escrow ID;
- invalid/non-future deadline;
- zero terms hash;
- fee above zero against the deployed zero-fee policy;
- exact nested SAC transfer authorization;
- failed transfer creates no escrow/liability;
- multi-asset liability conservation.

No contract test change may normalize an ABI or behavior change without explicit contract review.

### 14.3 Convex tests

- role matrix for owner, admin, procurement, finance, operations, and viewer;
- verified/unverified Importer and Exporter;
- organization isolation and not-found behavior;
- stale accepted revision and hash mismatch;
- unique intent and escrow key;
- repeated prepare and submission calls;
- same hash replay and different hash rejection;
- submitted/failed/unknown/confirmed transitions;
- exact getter match and every mismatch field;
- late confirmation;
- notification and audit deduplication;
- event receipt and cursor replay;
- reconciliation repair;
- transaction failure followed by safe retry;
- concurrent prepare/submit/reconcile attempts.

### 14.4 Component and accessibility tests

- every funding panel state;
- exact review facts and no misleading copy;
- role-based controls;
- disabled-state explanation;
- focus moves to the review dialog and returns correctly;
- wallet rejection/error announcement;
- pending and confirmed live-region behavior without excessive announcements;
- keyboard-only completion;
- screen-reader names and heading order;
- contrast, status icon/label, reduced motion;
- 320px, tablet, and desktop rendering;
- long wallet, hash, contract, and order values wrap or provide accessible expansion/copy.

### 14.5 Playwright journeys

- USDC happy path;
- XLM happy path where the test environment supports it;
- wallet rejection;
- wrong network;
- connected wallet differs from the Importer snapshot;
- missing USDC trustline;
- deauthorized trustline;
- insufficient balance;
- deadline expiry between review and submission;
- simulation failure;
- disconnected wallet during review;
- delayed confirmation;
- refresh after submit;
- browser close after submit;
- duplicate click and repeated route load;
- terminal failure and safe retry;
- projection mismatch;
- Exporter sees confirmation only after reconciliation;
- third organization cannot discover the escrow.

### 14.6 Testnet smoke

Use approved QA identities and the verified deployment. Capture:

- source commit and dirty/clean status;
- manifest and artifact digests;
- network, contract, and SAC identities;
- Trade Order/revision fixture identifiers;
- expected arguments;
- simulation result and authorization-tree digest;
- transaction hash and ledger;
- decoded event;
- getter result;
- application projection;
- both-party UI evidence;
- reconciliation duration;
- final contract balance/liability control;
- known limitations and sign-offs.

Do not capture secrets, session tokens, private keys, raw signed XDR, or confidential Trade Document contents.

## 15. UI state and copy matrix

| State | Primary message | Primary action |
|---|---|---|
| Ineligible | This Trade Order is not ready for funding. | Explain the exact missing condition |
| Unauthorized | Your organization role cannot fund escrow. | Contact an owner/admin |
| Wallet disconnected | Connect the accepted Importer wallet to continue. | Connect wallet |
| Wrong wallet | The connected wallet does not match the accepted Importer wallet. | Switch account |
| Wrong network | Switch Freighter to Stellar Testnet. | Retry check |
| Readiness failed | Balance or trustline is not ready for this asset. | Show specific recovery |
| Ready | Review the exact escrow funding transaction. | Review funding |
| Awaiting signature | Review and approve the Testnet transaction in Freighter. | Cancel only before submission |
| Submitting | The signed transaction is being submitted. | No duplicate action |
| Submitted | Funding was submitted and is awaiting confirmed chain state. | Resume/check status |
| Delayed | Confirmation is taking longer than expected; do not fund again. | Continue tracking |
| Failed, proven | The transaction failed and no escrow was created. | Review and retry |
| Reconciliation required | Movix cannot yet prove the final chain state. Do not fund again. | Retry reconciliation/support |
| Funded | The exact amount is confirmed in the Testnet escrow. | View receipt/explorer |

## 16. Security and privacy review

- Derive all financial arguments server-side from authorized canonical records.
- Require backend organization and role authorization for every public funding operation.
- Recheck wallet, network, accepted revision, amount, asset, terms hash, deadline, and intent immediately before signing/submission.
- Validate simulation authorization, not only displayed arguments.
- Pin network, contract, passphrase, asset, fee, and deployment identity.
- Keep private keys and seed phrases outside Movix.
- Do not log access tokens, cookies, raw challenges, raw signed transactions, or confidential order/document contents.
- Treat public wallet addresses and transaction hashes as participant-scoped application data even though they are public on Testnet.
- Rate-limit preparation, submission recording, resume, and manual reconciliation.
- Use correlation IDs that do not expose secrets.
- Fail closed on provider ambiguity, decoder drift, unknown events, ABI mismatch, or projection mismatch.
- Retain immutable financial audit history; repair by reconciliation, never by deleting contradictory evidence.

## 17. Evidence and definition of done

Sprint 7 is done only when:

- [ ] All S7-F01 through S7-F10 P0 acceptance criteria pass.
- [ ] No open P0 defect remains.
- [ ] Sprint 6 entry gates are closed or explicitly approved as a release exception by Product, Security, QA, and Operations.
- [ ] Contract source, ABI, WASM, constructor, bindings, events, and error codes remain unchanged.
- [ ] Typecheck, lint, formatting, unit tests, component tests, backend tests, contract tests, and production build pass.
- [ ] Authenticated two-organization Playwright passes.
- [ ] Keyboard, screen-reader, responsive, and error-state manual review passes.
- [ ] Local-ledger XLM-like and USDC-like funding proof passes.
- [ ] Approved Testnet USDC funding smoke passes.
- [ ] Rejected-signature and refresh/browser-close recovery are demonstrated.
- [ ] Submitted, failed, unknown, and confirmed states remain distinguishable.
- [ ] Both parties see the same exact confirmed facts.
- [ ] Event ingestion replay produces no duplicate transition, audit, or notification.
- [ ] No unexplained balance, liability, event, getter, or projection mismatch exists.
- [ ] Security/privacy review passes.
- [ ] Operations thresholds, repair path, and runbook are recorded.
- [ ] Evidence index, test report, known limitations, demo evidence, and release notes are committed.
- [ ] Product, Web, Backend, Stellar, QA, Security, and DevOps owners sign the evidence register.

## 18. Required evidence structure

Create `docs/evidence/sprint-07/README.md` with:

- scope and environment;
- source/manifest/artifact identity;
- automated command results;
- local-ledger evidence;
- Testnet transaction and getter evidence;
- event/cursor evidence;
- UI and accessibility evidence;
- recovery evidence;
- security/privacy checklist;
- known limitations;
- open defects and disposition;
- sign-off table.

Evidence status must distinguish:

- implemented;
- automated verification passed;
- Testnet verification passed;
- manual review passed;
- approved for pilot.

Do not label engineering completion as pilot approval.

## 19. Capacity cut line

If capacity falls:

1. Remove S7-F11 enhancements that are not needed to detect P0 mismatches.
2. Complete USDC before the XLM browser path while retaining XLM contract/local regression.
3. Reduce receipt polish, not receipt facts.
4. Use one supported pilot wallet while preserving the wallet adapter.

Never cut:

- exact integer amounts;
- verified deployment and asset allowlist;
- accepted-revision and terms-hash binding;
- backend authorization;
- simulation and explicit transaction review;
- submitted-versus-confirmed distinction;
- idempotency and duplicate prevention;
- getter reconciliation;
- refresh/browser-close recovery;
- event/cursor replay safety;
- financial transition tests;
- accessibility of the critical funding journey.

## 20. Elliot handoff checklist

Before coding:

- [ ] Read this document, the master sprint plan, escrow v1 ABI, deployment manifest, and Sprint 6 release evidence.
- [ ] Confirm the `fundingDeadline -> accept_by` Sprint 7 rule and approved safety buffer with Product.
- [ ] Confirm finality, retry, cursor, and alert thresholds with Stellar/DevOps.
- [ ] Turn S7-F01 through S7-F10 into implementation tasks with test tasks paired to each.
- [ ] Add failing executable specifications before the value-moving path.

Before opening the implementation review:

- [ ] Include a file/change map and migration notes.
- [ ] Include manifest/binding drift proof.
- [ ] Include authorization and idempotency tests.
- [ ] Include UI state screenshots or test artifacts for critical states.
- [ ] Include local-ledger and Testnet evidence links.
- [ ] State any unverified human or external gate explicitly.

Before marking complete:

- [ ] Run every Definition of Done gate.
- [ ] Reconcile the exact demo escrow and liability.
- [ ] Verify both participant views.
- [ ] Demonstrate rejection and interrupted-submission recovery.
- [ ] Obtain named sign-offs.
