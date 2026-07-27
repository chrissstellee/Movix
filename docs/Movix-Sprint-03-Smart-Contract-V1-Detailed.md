# Movix Sprint 3 — Detailed Smart Contract v1 and Testnet Proof Plan

**Prepared:** July 27, 2026  
**Sprint:** 3 of 10  
**Duration:** 2 weeks / 10 working days  
**Primary implementation owner:** Elliot  
**Product owner:** Nicole / Chris  
**Primary disciplines:** Contract, Stellar, QA, DevOps, Architecture  
**Status:** Ready for sprint planning, subject to the definition-of-ready gate in Section 6  
**Delivery target:** Frozen testnet escrow contract v1, generated TypeScript bindings, and reproducible local/testnet evidence

## 1. Purpose and planning authority

This document turns the Sprint 3 entry in [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md) into an implementation-ready delivery contract for Elliot.

The master sprint plan is the delivery-sequence authority. It explicitly reprioritized Sprint 3 after Sprint 2 so Movix proves the complete value-moving contract before returning to procurement UI work.

The older handoff at the end of [Sprint 2](./Movix-Sprint-02-Business-Onboarding-Detailed.md) still refers to the previous procurement-first Sprint 3. That handoff is superseded for sprint sequencing. Its identity, organization, and authorization facts remain useful, but its Sprint 3 order-page scope does not apply to this sprint.

When this document conflicts with an older phase number or sprint label:

1. The current master sprint plan controls delivery order and scope.
2. This detailed document controls Sprint 3 execution and acceptance.
3. The implementation plan remains the architecture source unless this document makes a narrower v1 decision.
4. A contract ABI or financial-invariant change requires Product, Architecture, Contract, and QA review before implementation continues.

## 2. Sprint outcome

Sprint 3 proves that Movix can hold and settle value safely before product pages depend on the contract.

At sprint close:

- One immutable escrow contract v1 artifact exists.
- The full lifecycle is implemented: fund, accept, ship, release, mutual refund, and expired-unaccepted cancellation.
- Contract authorization, state transitions, exact payouts, per-token liability, TTL behavior, events, and stable errors are verified.
- Real SAC behavior is proven on a local Stellar network.
- The exact release WASM is deployed to Stellar testnet.
- TypeScript bindings are generated from the exact release WASM, not hand-written from a parallel ABI.
- A deployment manifest links contract version, source commit, optimized WASM hash, contract ID, network, assets, bindings, and test evidence.
- Later sprints can integrate the frozen ABI without guessing financial behavior.

## 3. Capacity assumption

The two-week commitment assumes:

- Elliot is the primary implementer.
- Contract/security review is available at the Day 1, Day 5, and Day 10 gates.
- QA and DevOps can support local-ledger, fuzz, artifact, and deployment work.
- A local Stellar network can run in Docker or an equivalent supported environment.
- Testnet accounts and approved test assets are available without waiting for external onboarding.

The P0 backlog is approximately 12–14 focused engineering days before reviewer effort. Work overlaps across contract, QA, Stellar, and DevOps disciplines. If Elliot is working alone without reviewer or infrastructure support, preserve the scope and extend the calendar rather than cutting authorization, invariant, SAC, or recovery evidence.

P1 static and mutation analysis may move only after all P0 gates are green. No P0 value-movement or verification item may move to preserve an arbitrary date.

## 4. Current repository baseline

The baseline was inspected and exercised on July 27, 2026.

### 4.1 Contract baseline

`contracts/escrow` currently contains:

- `soroban-sdk = 27.0.2`
- A `#![no_std]` contract crate.
- Typed `TtlConfig`, `Config`, `Status`, `Escrow`, `DataKey`, and `Error` scaffolding.
- An atomic `__constructor`.
- `get_config`.
- A typed `Configured` event.
- Constructor validation for non-empty assets, fee ceiling, and TTL ordering.
- Two passing native Rust tests.

The existing `Escrow` type does not yet include all v1 timestamps, deadlines, refund-resume fields, shipment/delivery hashes, or liability behavior. No value-moving lifecycle function exists yet.

### 4.2 Stellar package baseline

`packages/stellar` currently contains:

- Testnet-only network configuration.
- Approved XLM and USDC contract constants.
- Exact amount helpers.
- Transaction orchestration types.
- Wallet/auth support from earlier sprints.
- Placeholder escrow-client and normalized-event interfaces.
- A declared generated-binding destination: `generated/escrow`.
- Eighteen passing tests and a passing TypeScript check.

The escrow client is not generated yet. Event and error decoding are placeholders.

### 4.3 Toolchain observed

- Stellar CLI: `27.0.0`
- Stellar XDR: `27.0.0`
- Rust: `1.97.1`
- Cargo: `1.97.1`
- Node: `22.13.1`

The current contract:

- Passes `cargo test --manifest-path contracts/Cargo.toml --lib`.
- Builds to WASM.
- Exposes only `__constructor` and `get_config`.
- Produces a 3,532-byte pre-Sprint-3 WASM with hash `e25e6b1a233921804fcd656ca76c410ad8cfec9d853679fb70a94767b1e8c73e`.

That hash is baseline evidence only. It is not a release hash.

### 4.4 Known baseline gap

The installed Stellar CLI reports that optimization is skipped because the CLI lacks the `additional-libs` feature. Sprint 3 cannot close on an unoptimized release artifact. Day 1 must provide a release-capable Stellar CLI in the developer and CI release environments and record its version.

### 4.5 Missing Sprint 3 assets

The repository does not yet have:

- A frozen escrow v1 ABI specification.
- A threat model for value-moving functions.
- Complete state/storage types.
- Per-token liability.
- Lifecycle functions or token transfers.
- Exact authorization-tree tests.
- Property or fuzz tests.
- Local-network SAC fixtures and smoke scripts.
- Generated TypeScript escrow bindings.
- Error/event decoders for the generated ABI.
- An immutable deployment manifest.
- Sprint 3 evidence or contract operations documentation.

## 5. Sprint goal and demo

**Sprint goal:** Complete and prove the full Movix escrow contract v1 before resuming procurement UI work.

The sprint review must use one exact release artifact and demonstrate:

1. A clean scripted local network starts.
2. Deterministic buyer, supplier, treasury, and asset fixtures are created.
3. The optimized escrow WASM is deployed once with immutable configuration.
4. The buyer funds an escrow in exact integer units.
5. The supplier accepts the matching terms hash.
6. The supplier records an opaque shipment commitment.
7. The buyer confirms delivery.
8. The contract releases exact net value to the supplier and the snapshotted fee to treasury.
9. A separate escrow completes a buyer- or supplier-initiated mutual refund.
10. A separate expired, unaccepted escrow is cancelled by its buyer.
11. At least one unauthorized or invalid transition fails without moving state or value.
12. Contract balance, per-token liability, getters, events, and ledger state agree after every step.
13. The same release WASM passes a testnet smoke lifecycle.
14. Generated TypeScript bindings compile and decode the release ABI.
15. The deployment manifest and evidence identify the exact source commit, WASM hash, ABI version, bindings, network, and contract ID.

The demo is incomplete if it uses mocked token movement, a different WASM from the manifest, `mock_all_auths` as the only authorization evidence, or manually maintained TypeScript method definitions.

## 6. Definition of ready

Sprint implementation begins only when the following are true:

- [ ] The baseline Rust tests and WASM build are green.
- [ ] `packages/stellar` tests and type checking are green.
- [ ] Product, Architecture, Contract, and QA accept the v1 decisions in Sections 9–18.
- [ ] Stellar CLI, `soroban-sdk`, testnet protocol, and RPC compatibility are checked and recorded.
- [ ] A Stellar CLI build capable of optimized contract builds is available for release work.
- [ ] The testnet XLM SAC and approved USDC issuer/SAC are independently re-verified against an authoritative source.
- [ ] The local-network runner is available.
- [ ] Deterministic local actor and token fixtures can be created without committing secret keys.
- [ ] Testnet source accounts can be funded without putting secrets in scripts, logs, manifests, or evidence.
- [ ] The P0/P1 cut line and three review gates have named owners.
- [ ] The contract version, schema version, and error-number preservation rules are accepted.

Sprint 2’s remaining UI/E2E sign-offs do not block isolated contract work unless Sprint 3 tries to consume those surfaces. Elliot must not repair unrelated Sprint 2 application behavior inside this sprint. Any dependency failure is recorded and escalated; it is not bypassed with browser-trusted identity, assets, amounts, or contract IDs.

## 7. Scope

### 7.1 P0 committed scope

- S3-01 through S3-14 from the master sprint plan.
- Frozen contract v1 types, ABI, state machine, authorization, errors, and events.
- Constructor hardening and bounded configuration.
- Atomic create-and-fund.
- Bounded getters.
- Supplier acceptance and shipment commitment.
- Buyer delivery confirmation and exact release.
- Full two-party refund proposal, approval, rejection, and withdrawal.
- Buyer cancellation of an expired unaccepted escrow.
- Per-token liability and balance invariants.
- Instance, code, escrow, and liability TTL handling.
- Unit, authorization, boundary, property, fuzz-regression, snapshot, resource, race, and real-SAC tests.
- Optimized WASM, hash, bindings, decoder, scripts, deployment manifest, and local/testnet proof.
- Contract-specific security, operations, and evidence documentation.

### 7.2 P1 scope

- S3-15 static and mutation analysis.
- Additional resource optimization after P0 budgets pass.
- Additional deterministic fuzz corpus beyond the P0 seed set.
- Developer ergonomics that do not change the frozen ABI.

### 7.3 Explicitly out of scope

- Buyer, supplier, order, funding-review, shipment, refund, or transaction-history pages.
- Convex event indexing, reconciliation workers, notifications, dashboards, or production projections.
- Browser transaction assembly for production journeys.
- Partial funding, milestone funding, partial release, partial refund, multiple shipments, disputes, resolvers, or auto-release.
- Arbitrary assets.
- Mutable contract configuration.
- Public upgrade, migration, pause, rescue, or administrator fund-movement functions.
- Mainnet deployment.
- Claims that a hash proves physical shipment or delivery.

Fixtures may model future integration inputs, but fixtures must not widen production scope.

## 8. Actors and trust boundaries

| Actor/system | Trusted for | Not trusted for |
|---|---|---|
| Buyer address | Authorizing funding, delivery confirmation, refund proposal/response, and eligible timeout cancellation | Choosing an unsupported token, changing supplier or terms after funding, bypassing state |
| Supplier address | Accepting snapshotted terms, marking shipment, refund proposal/response | Releasing funds, changing buyer or amount, approving its own refund |
| Treasury address | Receiving the snapshotted release fee | Moving escrow principal or changing fee/config |
| Escrow contract | Lifecycle, authorization checks, token movement, immutable snapshots, liability | Commercial text, identity verification, shipment truth, dispute adjudication |
| SAC/token contract | Token balances, authorization, and transfer behavior | Movix lifecycle or commercial meaning |
| Convex | Commercial records, searchable projections, later reconciliation workflow | Authoritative custody state or terminal payout |
| Browser/wallet | Presenting and signing a user-reviewed transaction | Authoritative asset allowlist, amount conversion, contract ID, lifecycle, or confirmation |
| Deployment operator | Supplying reviewed constructor config and publishing artifacts | Reconfiguring or rescuing funds after deployment |
| Testnet/RPC | Execution and query access for the pilot | Mainnet readiness, legal settlement policy, or permanent availability |

No privileged actor can override buyer/supplier authorization, change an escrow, release/refund/cancel administratively, or withdraw surplus through contract v1.

## 9. Fixed product and architecture decisions

The following decisions are frozen for v1:

1. The release is testnet-only.
2. One pooled escrow contract instance serves many escrow IDs for one immutable deployed version.
3. The contract has no public upgrade function and no mutable initialization function.
4. Configuration is supplied only to `__constructor`.
5. XLM and one approved testnet USDC move through their network-specific SACs.
6. Constructor configuration accepts one or two unique SAC addresses; the Sprint 3 release manifest must contain both approved assets.
7. Treasury is immutable, must not be the escrow contract’s own address, and is never an authorization role.
8. Browser input cannot select an arbitrary token or contract address.
9. One escrow holds one asset and one gross amount.
10. Funding is all-or-nothing.
11. Release, refund, and cancellation are full and terminal.
12. The platform-fee capability exists, but the pilot deployment uses `fee_bps = 0`.
13. Fee configuration is snapshotted per escrow at creation.
14. Fee rounding uses integer floor division.
15. A refund returns the full gross amount to the buyer; no fee is charged on refund or cancellation.
16. Supplier release pays `gross_amount - fee_amount` to the supplier and `fee_amount` to treasury.
17. Contract time uses ledger timestamp, not client time and not TTL.
18. Supplier acceptance is allowed only while `now < accept_by`.
19. Buyer timeout cancellation is allowed while `now >= accept_by` and status is exactly `Funded`.
20. The exact deadline boundary belongs to cancellation, avoiding an overlap or gap.
21. Terms, shipment, delivery, and refund commitments are `BytesN<32>` opaque hashes.
22. All-zero commitment hashes are rejected as missing input.
23. A shipment or delivery hash is a party commitment, not independent proof of a physical event.
24. PII, legal text, line items, addresses, invoices, and files never enter contract storage or events.
25. Contract getters are bounded. Lists and pagination belong off-chain.
26. Contract state is authoritative for held funds and terminal payout.
27. Events support indexing but are not sufficient alone to prove current state; later reconciliation confirms material state through getters.
28. Contract v1 has no liveness solution after supplier shipment if the buyer refuses both release and mutual refund.
29. Mainnet remains blocked pending an explicit liveness policy, external security review, legal review, and incident ownership.

## 10. Threat model and required controls

| Threat | Required control | Required evidence |
|---|---|---|
| Unauthorized funding actor | Match buyer argument, call `buyer.require_auth`, assert exact nested SAC auth | Exact authorization-tree test |
| Unauthorized transition actor | Compare actor to snapshotted participant before authorization/effect | Wrong-party tests for every entry point |
| Malicious token substitution | Constructor allowlist plus `UnsupportedAsset` before transfer | Wrong-SAC unit and local-network tests |
| Duplicate escrow/funding | Persistent unique escrow key and atomic write/transfer | Duplicate-ID and concurrent-submission tests |
| Same buyer and supplier | Reject during creation | Typed error and unchanged-balance assertion |
| Amount overflow/underflow | Positive `i128`, checked multiply/subtract/add | Boundary/property tests |
| Fee overcharge | `fee_bps <= config.max_fee_bps <= 10_000`, snapshotted fee amount | Fee cap, rounding, and conservation tests |
| Stale or altered terms | Immutable `terms_hash`; supplier must present exact match | Hash-mismatch tests |
| Early timeout cancellation | Ledger timestamp and exact `Funded` state | Before/equal/after boundary tests |
| Self-approved refund | Proposer snapshot and opposite-party check | Buyer and supplier same-party approval tests |
| Stale refund response | Exact refund hash, proposer, and pending state | Reject/approve/withdraw stale-hash tests |
| Double payout | Terminal immutability and one liability decrement | Repeated/race/property tests |
| Release during refund | `RefundPending` rejects release and cancellation | Transition/race tests |
| Failed nested token transfer | All state, liability, and events share transaction atomicity | Real-SAC rollback test |
| Liability drift | Per-token checked liability and balance comparison | Every-step and arbitrary-sequence properties |
| Unbounded cost | Maximum two configured assets, one-escrow getter, no list API | ABI inspection and resource report |
| Archived state/code | Hot-path TTL extension plus later keeper/runbook | TTL/archive/restore evidence |
| PII disclosure | Fixed typed fields/events and review against prohibited data list | Event XDR and storage snapshot review |
| Artifact mismatch | Source commit, WASM hash, generated bindings, and manifest linked | Release verification script |
| Operator custody backdoor | No admin transfer, rescue, arbitrary call, or mutable config | ABI review and negative security checklist |

## 11. On-chain and off-chain authority

### 11.1 Soroban is authoritative for

- Contract and schema version.
- Escrow ID.
- Buyer and supplier addresses.
- Token/SAC address.
- Gross integer amount.
- Snapshotted fee basis points and fee amount.
- Creation and last-update timestamps.
- Acceptance deadline.
- Terms, shipment, delivery, and refund hashes.
- Refund proposer and resume state while pending.
- Current contract status.
- Per-token active liability.
- Terminal token payout.

### 11.2 Convex remains authoritative for

- Organizations, memberships, roles, and business identity.
- Purchase-order header, lines, commercial and delivery terms.
- Canonical off-chain hashing inputs and human-readable documents.
- Shipment fields and evidence.
- Refund reasons and human communication.
- Submitted transaction records and searchable projections.
- Notifications, audit, reconciliation cursors, and operational workflow.

### 11.3 Browser is never authoritative for

- Network passphrase.
- Release contract ID.
- Allowed SAC addresses.
- Integer amount conversion.
- Contract status or finality.
- Participant authorization.
- Whether a transaction actually succeeded.

## 12. Frozen contract v1 types

All exported types use bounded Soroban-compatible values and `#[contracttype]`.

### 12.1 Constants

| Constant | v1 value/meaning |
|---|---|
| `CONTRACT_VERSION` | `1` |
| `ESCROW_SCHEMA_VERSION` | `1` |
| `BPS_DENOMINATOR` | `10_000` |
| `MAX_SUPPORTED_ASSETS` | `2` |

Version values are integers in the contract interface. Human release labels belong in metadata and the deployment manifest.

### 12.2 `TtlConfig`

```text
threshold: u32
extend_to: u32
```

Rules:

- `threshold > 0`
- `extend_to > threshold`
- Values must be within the live network limits recorded at deployment.
- The same policy applies to instance, code, escrow, and liability extension in v1.

### 12.3 `Config`

```text
treasury: Address
supported_sac_addresses: Vec<Address>
max_fee_bps: u32
ttl: TtlConfig
```

Rules:

- Treasury must not equal the current escrow contract address.
- One or two assets.
- No duplicate SAC address.
- `max_fee_bps <= 10_000`.
- Sprint 3 release includes the approved XLM and USDC SACs.
- Configuration is immutable after construction.

### 12.4 `Status`

```text
Funded
Accepted
Shipped
RefundPending
Released
Refunded
Cancelled
```

Terminal statuses are `Released`, `Refunded`, and `Cancelled`.

### 12.5 `Escrow`

```text
schema_version: u32
id: BytesN<32>
buyer: Address
supplier: Address
token: Address
gross_amount: i128
fee_bps: u32
fee_amount: i128
status: Status
resume_status: Option<Status>
created_at: u64
accept_by: u64
terms_hash: BytesN<32>
shipment_hash: Option<BytesN<32>>
delivery_hash: Option<BytesN<32>>
refund_proposer: Option<Address>
refund_terms_hash: Option<BytesN<32>>
last_updated_at: u64
```

Field rules:

- Immutable after funding: schema version, ID, parties, token, gross amount, fee fields, creation time, acceptance deadline, and terms hash.
- `shipment_hash` is set exactly once by `mark_shipped`.
- `delivery_hash` is set exactly once by successful release.
- `resume_status` is present only during `RefundPending`.
- `refund_proposer` and `refund_terms_hash` are both present during `RefundPending`.
- Rejection or withdrawal clears all pending-refund fields.
- Approval clears `resume_status` and retains the approved proposer/hash as terminal audit data.
- Every successful transition sets `last_updated_at` from the ledger timestamp.

### 12.6 `DataKey`

```text
Config
Escrow(BytesN<32>)
Liability(Address)
```

`Config` is stored in instance storage. Escrows and liabilities use separate persistent keys.

## 13. Frozen public ABI

| Function | Return | Required authorization | Effect |
|---|---|---|---|
| `__constructor(config)` | none | Deployment transaction | Validate and store immutable config |
| `get_version()` | `u32` | Public read | Return contract version `1` |
| `get_config()` | `Config` | Public read | Return bounded immutable config |
| `get_escrow(id)` | `Escrow` | Public read | Return one escrow or typed not-found error |
| `get_liability(token)` | `i128` | Public read | Return tracked active liability, defaulting to zero for a supported token |
| `create_and_fund(id, buyer, supplier, token, amount, fee_bps, accept_by, terms_hash)` | `Escrow` | Buyer | Transfer exact amount into contract and create `Funded` |
| `accept(id, supplier, terms_hash)` | `Escrow` | Snapshotted supplier | `Funded → Accepted` before deadline |
| `mark_shipped(id, supplier, shipment_hash)` | `Escrow` | Snapshotted supplier | `Accepted → Shipped` |
| `confirm_delivery(id, buyer, delivery_hash)` | `Escrow` | Snapshotted buyer | `Shipped → Released` and exact payout |
| `propose_refund(id, proposer, refund_terms_hash)` | `Escrow` | Buyer or supplier | Active state → `RefundPending` |
| `approve_refund(id, approver, refund_terms_hash)` | `Escrow` | Opposite party | `RefundPending → Refunded` and full buyer refund |
| `reject_refund(id, approver, refund_terms_hash)` | `Escrow` | Opposite party | Restore exact prior active state |
| `withdraw_refund(id, proposer, refund_terms_hash)` | `Escrow` | Original proposer | Restore exact prior active state |
| `cancel_unaccepted(id, buyer)` | `Escrow` | Snapshotted buyer | Expired `Funded → Cancelled` and full buyer refund |

No other public function belongs in v1. In particular, do not add:

- `initialize`
- `set_config`
- `set_treasury`
- `set_fee`
- `add_asset`
- `remove_asset`
- `upgrade`
- `pause`
- `rescue`
- `admin_transfer`
- `list_escrows`
- `list_user_escrows`
- A generic call/execute function

## 14. Function contracts

### 14.1 `__constructor`

Order of work:

1. Validate treasury is not the current escrow contract address.
2. Validate supported asset count.
3. Validate uniqueness.
4. Validate fee cap.
5. Validate TTL ordering and network-compatible bounds.
6. Store config in instance storage.
7. Extend instance and code TTL.
8. Publish `Configured`.

Acceptance:

- Failure writes no config and emits no event.
- Deployment has no reinitialization path.
- Config getter returns exactly the constructed value.

### 14.2 `create_and_fund`

Validation order:

1. Load configuration.
2. Reject an existing escrow ID.
3. Reject buyer equal to supplier.
4. Reject unsupported token.
5. Reject `amount <= 0`.
6. Reject `fee_bps > config.max_fee_bps`.
7. Reject `accept_by <= ledger_timestamp`.
8. Reject an all-zero terms hash.
9. Compute fee and net with checked arithmetic.
10. Match the declared buyer and require buyer authorization.
11. Transfer exactly `amount` from buyer to the current contract through the selected SAC.
12. Increase that token’s liability by exactly `amount`.
13. Store the complete `Funded` escrow.
14. Extend relevant TTLs.
15. Emit `Funded`.

The transaction is atomic. A token error, authorization failure, storage failure, arithmetic failure, or invariant failure leaves no escrow, liability increment, or lifecycle event.

### 14.3 `accept`

Required conditions:

- Escrow exists.
- Status is exactly `Funded`.
- `ledger_timestamp < accept_by`.
- Actor equals the snapshotted supplier.
- Supplied terms hash equals the immutable escrow terms hash.
- Supplier authorizes.

Effect:

- Set `Accepted`.
- Update timestamp and TTL.
- Emit `Accepted`.
- Do not move tokens or change liability.

### 14.4 `mark_shipped`

Required conditions:

- Escrow exists.
- Status is exactly `Accepted`.
- Actor equals the snapshotted supplier.
- Shipment hash is not all zero.
- Supplier authorizes.

Effect:

- Set `shipment_hash` once.
- Set `Shipped`.
- Update timestamp and TTL.
- Emit `Shipped`.
- Do not move tokens or change liability.

### 14.5 `confirm_delivery`

Required conditions:

- Escrow exists.
- Status is exactly `Shipped`.
- Actor equals the snapshotted buyer.
- Delivery hash is not all zero.
- Buyer authorizes.
- Stored fee and net values remain arithmetically valid.
- Token balance can satisfy the payout and remaining liability.

Atomic effect:

1. Transfer `gross_amount - fee_amount` from the contract to supplier.
2. If fee is positive, transfer `fee_amount` from the contract to treasury.
3. Decrease token liability by exactly `gross_amount`.
4. Store delivery hash.
5. Set `Released`.
6. Update timestamp and TTL.
7. Emit `Released`.

Both transfers, liability, state, and event either all succeed or all roll back.

### 14.6 `propose_refund`

Required conditions:

- Status is one of `Funded`, `Accepted`, or `Shipped`.
- Proposer is the snapshotted buyer or supplier.
- Refund terms hash is not all zero.
- Proposer authorizes.
- No refund is already pending.

Effect:

- Save the exact current status in `resume_status`.
- Save proposer and refund terms hash.
- Set `RefundPending`.
- Update timestamp and TTL.
- Emit `RefundProposed`.
- Do not move tokens or change liability.

### 14.7 `approve_refund`

Required conditions:

- Status is exactly `RefundPending`.
- Approver is the opposite snapshotted party.
- Approver is not the recorded proposer.
- Supplied refund hash matches the recorded hash.
- Approver authorizes.

Atomic effect:

1. Transfer the full `gross_amount` from contract to buyer.
2. Decrease token liability by the full `gross_amount`.
3. Clear `resume_status`.
4. Preserve approved proposer/hash for terminal audit.
5. Set `Refunded`.
6. Update timestamp and TTL.
7. Emit `Refunded`.

No platform fee is paid on a refund.

### 14.8 `reject_refund`

Required conditions match approval except the effect is non-financial.

Effect:

- Restore the exact status in `resume_status`.
- Clear resume status, proposer, and refund terms hash.
- Update timestamp and TTL.
- Emit `RefundRejected`, including the restored status.
- Do not move tokens or change liability.

### 14.9 `withdraw_refund`

Required conditions:

- Status is exactly `RefundPending`.
- Actor equals the recorded proposer.
- Supplied refund hash matches.
- Proposer authorizes.

Effect:

- Restore the exact prior active status.
- Clear pending-refund fields.
- Update timestamp and TTL.
- Emit `RefundWithdrawn`.
- Do not move tokens or change liability.

### 14.10 `cancel_unaccepted`

Required conditions:

- Status is exactly `Funded`.
- Actor equals the snapshotted buyer.
- `ledger_timestamp >= accept_by`.
- Buyer authorizes.

Atomic effect:

1. Transfer full gross amount from contract to buyer.
2. Decrease token liability by full gross amount.
3. Set `Cancelled`.
4. Update timestamp and TTL.
5. Emit `Cancelled`.

An accepted, shipped, refund-pending, or terminal escrow cannot use this path.

## 15. Canonical state machine

| From | Function | Additional guard | To | Token/liability effect |
|---|---|---|---|---|
| None | `create_and_fund` | Unique ID; valid parties, asset, amount, fee, deadline, hash | `Funded` | Buyer → contract; liability +gross |
| `Funded` | `accept` | Supplier; matching terms; before deadline | `Accepted` | None |
| `Funded` | `cancel_unaccepted` | Buyer; at/after deadline | `Cancelled` | Contract → buyer; liability -gross |
| `Accepted` | `mark_shipped` | Supplier; non-zero shipment hash | `Shipped` | None |
| `Shipped` | `confirm_delivery` | Buyer; non-zero delivery hash | `Released` | Contract → supplier/treasury; liability -gross |
| `Funded` | `propose_refund` | Either party; non-zero hash | `RefundPending` | None |
| `Accepted` | `propose_refund` | Either party; non-zero hash | `RefundPending` | None |
| `Shipped` | `propose_refund` | Either party; non-zero hash | `RefundPending` | None |
| `RefundPending` | `approve_refund` | Opposite party; matching hash | `Refunded` | Contract → buyer; liability -gross |
| `RefundPending` | `reject_refund` | Opposite party; matching hash | Prior active state | None |
| `RefundPending` | `withdraw_refund` | Proposer; matching hash | Prior active state | None |

All unlisted transitions fail with no state, liability, token, TTL-dependent business, or lifecycle-event effect.

### 15.1 Race outcomes

Transactions serialize on ledger state:

- Release versus refund proposal: one succeeds; the second sees a disallowed state.
- Refund approval versus withdrawal: one succeeds; the second sees a non-pending state.
- Acceptance versus timeout cancellation at the boundary: acceptance fails at `now >= accept_by`; cancellation may succeed.
- Duplicate funding: one creates the ID; all later attempts fail.
- Repeated terminal calls: all fail.

Tests must assert final balances and liability, not only the second error.

## 16. Amount, fee, and liability contract

### 16.1 Integer amounts

- All contract amounts are base-unit `i128`.
- `amount > 0`.
- The contract never parses decimals or asset display strings.
- Asset decimal validation remains in trusted off-chain configuration.
- XLM and approved testnet USDC currently use seven decimal places in `packages/stellar`, but the contract remains integer-only.

### 16.2 Fee calculation

```text
fee_amount = floor(gross_amount * fee_bps / 10_000)
net_amount = gross_amount - fee_amount
```

All multiplication and subtraction use checked arithmetic.

Rules:

- `fee_bps <= config.max_fee_bps`.
- `config.max_fee_bps <= 10_000`.
- `fee_amount >= 0`.
- `net_amount >= 0`.
- `fee_amount + net_amount == gross_amount`.
- The pilot deployment config and calls use zero basis points.
- The fee snapshot cannot change after funding.

### 16.3 Per-token liability

Liability equals the sum of gross amounts for all non-terminal escrows using that token.

- Funding increases liability once.
- Accept, ship, refund proposal, rejection, and withdrawal do not change liability.
- Release, refund approval, or cancellation decreases liability once.
- Liability never becomes negative.
- After each successful value-moving function, token balance at the contract address must be at least the remaining tracked liability.
- Surplus tokens sent directly to the contract do not increase liability and cannot be withdrawn through v1.
- `get_liability` rejects unsupported tokens rather than treating an arbitrary address as configured.

## 17. Stable error catalog

Existing error numbers `1–8` are preserved. New numbers append and must never be reused for a different meaning.

| Code | Name | Meaning |
|---:|---|---|
| 1 | `InvalidConfig` | Constructor/config value is structurally invalid |
| 2 | `UnsupportedAsset` | Token is not in immutable allowlist |
| 3 | `InvalidAmount` | Amount is zero or negative |
| 4 | `SameParty` | Buyer and supplier are the same address |
| 5 | `EscrowExists` | Escrow ID already exists |
| 6 | `EscrowNotFound` | Escrow ID does not exist |
| 7 | `InvalidTransition` | Current status does not permit the function |
| 8 | `ArithmeticFailure` | Checked calculation failed |
| 9 | `FeeTooHigh` | Requested fee exceeds configured cap |
| 10 | `InvalidDeadline` | Creation deadline is not in the future |
| 11 | `AcceptanceExpired` | Supplier attempted acceptance at/after deadline |
| 12 | `CancellationTooEarly` | Buyer attempted cancellation before deadline |
| 13 | `TermsMismatch` | Acceptance terms hash differs from funded hash |
| 14 | `UnauthorizedParty` | Actor argument is not the required snapshotted party |
| 15 | `SamePartyApproval` | Refund proposer attempted to approve its own proposal |
| 16 | `RefundTermsMismatch` | Refund response hash differs from pending proposal |
| 17 | `RefundProposerMismatch` | Withdrawal actor is not the recorded proposer |
| 18 | `InvariantViolation` | Stored state, liability, or payout relationship is inconsistent |
| 19 | `InvalidHash` | Required commitment is all zero |
| 20 | `NotInitialized` | Required instance config is absent or unavailable |

Native host/token/authentication errors remain distinguishable from contract errors. TypeScript decoding must preserve the stable code and a safe user-facing category without hiding the original transaction failure.

## 18. Stable event catalog

Events are typed, bounded, indexable, and PII-free. Each lifecycle event includes the escrow ID and resulting status. Financial events include token and gross amount. Hashes are included only where the transition introduces or confirms one.

| Event | Trigger | Required data |
|---|---|---|
| `Configured` | Constructor | Treasury, supported-asset count, fee cap, contract version |
| `Funded` | Create/fund | ID, buyer, supplier, token, gross, fee, accept-by, terms hash, status |
| `Accepted` | Supplier accepts | ID, supplier, terms hash, status |
| `Shipped` | Supplier marks shipped | ID, supplier, shipment hash, status |
| `Released` | Buyer confirms delivery | ID, buyer, supplier, treasury, token, gross, fee, net, delivery hash, status |
| `RefundProposed` | Either party proposes | ID, proposer, refund terms hash, resume status, status |
| `RefundRejected` | Counterparty rejects | ID, proposer, responder, refund terms hash, restored status |
| `RefundWithdrawn` | Proposer withdraws | ID, proposer, refund terms hash, restored status |
| `Refunded` | Counterparty approves | ID, proposer, approver, buyer, token, gross, refund terms hash, status |
| `Cancelled` | Buyer cancels expired unaccepted escrow | ID, buyer, token, gross, accept-by, status |

Event rules:

- Publish only after all checks and effects succeed.
- Failed calls produce no lifecycle event.
- Event names and payload types are part of the frozen integration contract.
- Snapshot decoded values and raw event XDR for every success path.
- Keep indexed topics within live protocol limits.
- Do not include legal names, emails, addresses, line items, shipment text, reasons, files, or raw commercial JSON.

## 19. Storage and TTL policy

### 19.1 Storage placement

- Instance storage: immutable `Config`.
- Persistent storage: one `Escrow(id)` entry per escrow.
- Persistent storage: one `Liability(token)` entry per configured asset with activity.
- No temporary storage for business-critical state.
- No aggregate escrow vector or user list.

### 19.2 Hot-path TTL extension

Every public call loads config and extends instance/code TTL when below threshold.

- `get_escrow` and every escrow mutation extend that escrow entry.
- Value-moving functions extend the relevant liability entry.
- `get_liability` extends an existing liability entry.
- Active and terminal escrow reads extend their record; terminal history must not silently disappear from ordinary use.
- Later operations add an off-chain keeper. Sprint 3 documents and proves the contract-side behavior.

Use the SDK’s supported instance, persistent-entry, and deployer code-extension APIs. TTL config is validated against live network settings before deployment.

TTL is never:

- An acceptance deadline.
- Authorization.
- An automatic release/refund/cancellation mechanism.
- Evidence that a business event occurred.

### 19.3 Archive tests

Tests must cover:

- Threshold not reached: no harmful behavior.
- Threshold reached: extension occurs.
- Instance, code, escrow, and liability behavior.
- Archived/restored fixture behavior where supported.
- Explicit timestamps continue to decide deadlines.
- Restoring state does not permit replay of a terminal payout.

## 20. Generated bindings and integration contract

The canonical interface is embedded in the exact release WASM.

### 20.1 Generation rule

Generate TypeScript bindings from the release WASM:

```powershell
stellar contract bindings typescript `
  --wasm contracts/target/wasm32v1-none/release/movix_escrow.wasm `
  --output-dir packages/stellar/generated/escrow `
  --overwrite
```

The release script may wrap this command, but must not hand-maintain a second ABI.

### 20.2 `packages/stellar` responsibilities

- Commit or package the generated binding source according to repository policy.
- Export a stable Movix adapter from `src/contracts.ts`.
- Export generated types without replacing them with `unknown`.
- Decode all stable contract errors.
- Normalize all stable events.
- Validate configured network, contract ID, and allowed assets before client creation.
- Keep signing/submission result states distinct from confirmed contract state.
- Add tests that fail when ABI generation changes unexpectedly.

Generated files are not edited manually. Any ABI change requires:

1. Contract source change.
2. Full contract review/regression.
3. New optimized WASM and hash.
4. Regenerated bindings.
5. Manifest update.
6. Explicit version decision.

### 20.3 Deployment manifest

Create `deployments/stellar/testnet/escrow-v1.json` with at least:

- Manifest schema version.
- Contract version and escrow schema version.
- Network name and passphrase fingerprint/name.
- RPC environment label, not secret headers.
- Source commit SHA.
- Rust, `soroban-sdk`, Stellar CLI, and protocol versions.
- Optimized WASM path, size, and SHA-256 hash.
- Contract ID and deployment transaction hash/ledger.
- Constructor config excluding secrets.
- Treasury public address.
- Approved XLM and USDC issuer/SAC addresses.
- Fee cap and deployed pilot fee policy.
- TTL values and captured network limit reference.
- Binding generation command/version and binding digest.
- Evidence index path.
- Deployment timestamp.
- Testnet-only warning.

No secret seed, JWT, cookie, RPC credential, private key, or raw signed transaction belongs in the manifest.

## 21. Proposed repository target

```text
contracts/
  Cargo.toml
  escrow/
    Cargo.toml
    src/
      lib.rs
      storage.rs
      types.rs
      errors.rs
      events.rs
      lifecycle.rs
      test.rs
    fuzz/
      Cargo.toml
      fuzz_targets/
        lifecycle.rs
        value_movement.rs
packages/
  stellar/
    generated/
      escrow/
    src/
      contracts.ts
      events.ts
      contract-errors.ts
    tests or colocated *.test.ts
scripts/
  contracts/
    build.mjs
    generate-bindings.mjs
    local-setup.mjs
    local-smoke.mjs
    deploy-testnet.mjs
    testnet-smoke.mjs
    verify-release.mjs
deployments/
  stellar/
    testnet/
      escrow-v1.json
docs/
  contracts/
    escrow-v1/
      abi.md
      threat-model.md
      errors-and-events.md
      deployment-runbook.md
      testing-and-evidence.md
  evidence/
    sprint-03/
      README.md
```

The exact Rust module split may change if a smaller split is clearer. Public ABI, storage ownership, tests, scripts, manifest, and evidence paths may not be omitted.

Cross-platform Node scripts are preferred for orchestration. They may call the Stellar CLI but must fail closed, avoid secret output, and support a dry-run or help mode where destructive/testnet actions are involved.

## 22. Detailed backlog

## S3-01 — Freeze ABI, state machine, threat model, and errors

**Priority:** P0  
**Estimate:** 1.0 person-day  
**Disciplines:** Product, Architecture, Contract, QA  
**Dependencies:** None

Tasks:

- Review Sections 8–18.
- Produce `docs/contracts/escrow-v1/abi.md`.
- Produce the threat model and prohibited-function list.
- Record exact deadline, fee, refund, terminal, and hash rules.
- Freeze existing error codes 1–8 and append 9–20.
- Freeze event names/payload types.
- Record mainnet blockers.

Acceptance:

- Every public function, actor, argument, guard, transition, effect, event, and error is documented.
- Reviewers can derive every allowed and forbidden path.
- No value-moving implementation merges before this review.

Evidence:

- Approved ABI document.
- Threat-model review notes.
- Error/event catalog.
- Day 1 sign-off record.

## S3-02 — Complete typed storage and lifecycle models

**Priority:** P0  
**Estimate:** 1.0 person-day  
**Disciplines:** Contract  
**Dependencies:** S3-01

Tasks:

- Add missing escrow fields and constants.
- Add liability key.
- Add bounded helper functions and validity checks.
- Enforce legal optional-field combinations.
- Add type/storage snapshots.

Acceptance:

- Types match Section 12.
- Escrow and liability use fine-grained persistent keys.
- Invalid refund-resume combinations cannot be produced by public functions.
- No unbounded collection is stored or returned.

Evidence:

- Type tests.
- Ledger-state snapshots.
- ABI/spec diff.

## S3-03 — Harden constructor and deployment configuration

**Priority:** P0  
**Estimate:** 0.5 person-day  
**Disciplines:** Contract, DevOps  
**Dependencies:** S3-01, S3-02

Tasks:

- Validate one-to-two unique assets.
- Preserve fee and TTL checks.
- Add code TTL extension.
- Add version getter.
- Test treasury, asset, fee, TTL, and atomic constructor failures.
- Ensure no reinitialization entry point exists.

Acceptance:

- Constructor rules in Section 14.1 pass.
- Release configuration contains exactly approved XLM and USDC SACs.
- Constructor failure leaves no usable instance.

Evidence:

- Constructor tests/snapshots.
- Exported-function list.

## S3-04 — Implement atomic create-and-fund

**Priority:** P0  
**Estimate:** 1.25 person-days  
**Disciplines:** Contract  
**Dependencies:** S3-02, S3-03

Tasks:

- Implement validation and buyer authorization.
- Implement checked fee calculation.
- Call selected SAC for exact transfer.
- Create escrow and increase liability atomically.
- Emit funded event.
- Add boundary, auth, rollback, and duplicate tests.

Acceptance:

- Section 14.2 passes for both configured asset fixtures.
- Exact auth tree is asserted.
- Failed transfer or write leaves no escrow/liability/event.

Evidence:

- Rust tests.
- Auth snapshots.
- Token and ledger snapshots.

## S3-05 — Implement bounded public reads

**Priority:** P0  
**Estimate:** 0.25 person-day  
**Disciplines:** Contract, Stellar  
**Dependencies:** S3-02, S3-03

Tasks:

- Implement version, config, escrow, and liability getters.
- Add typed missing/unsupported behavior.
- Extend TTL on reads.
- Confirm no list function appears in spec.

Acceptance:

- All getters are bounded.
- Generated spec exposes only approved functions.
- Getter values match committed state.

Evidence:

- Getter tests.
- Exported ABI report.

## S3-06 — Implement supplier acceptance and shipment

**Priority:** P0  
**Estimate:** 0.75 person-day  
**Disciplines:** Contract  
**Dependencies:** S3-04

Tasks:

- Implement deadline-aware acceptance with terms match.
- Implement one-time shipment hash.
- Assert snapshotted supplier auth.
- Add transition, hash, duplicate, and wrong-party tests.

Acceptance:

- `Funded → Accepted → Shipped` is the only success path.
- No token/liability movement occurs.
- Expired acceptance and zero shipment hash fail.

Evidence:

- Tests, auth trees, events, and state snapshots.

## S3-07 — Implement delivery confirmation and exact release

**Priority:** P0  
**Estimate:** 1.0 person-day  
**Disciplines:** Contract  
**Dependencies:** S3-04, S3-06

Tasks:

- Implement buyer authorization.
- Recheck fee/net invariants.
- Implement atomic supplier/treasury payout.
- Decrease liability once.
- Store delivery hash and terminal state.
- Add rollback, repeated, race, and conservation tests.

Acceptance:

- Exact gross conservation holds for zero and non-zero fee fixtures.
- Failed payout leaves `Shipped`, original liability, and balances.
- Release cannot succeed twice or outside `Shipped`.

Evidence:

- Payout tables.
- Exact auth/state/event snapshots.
- Property/regression tests.

## S3-08 — Implement mutual refund protocol

**Priority:** P0  
**Estimate:** 1.25 person-days  
**Disciplines:** Contract  
**Dependencies:** S3-04, S3-06

Tasks:

- Implement proposal from every active state.
- Implement opposite-party approval and full refund.
- Implement rejection and withdrawal restoration.
- Clear or retain refund fields according to Section 12.5.
- Add same-party, stale-hash, wrong-actor, race, and rollback tests.

Acceptance:

- Two different parties approve identical refund terms.
- Rejection/withdrawal restores exactly `Funded`, `Accepted`, or `Shipped`.
- Approval decreases liability and returns gross once.

Evidence:

- State matrix tests.
- Buyer- and supplier-proposed flows.
- Race/property tests.

## S3-09 — Implement expired-unaccepted cancellation

**Priority:** P0  
**Estimate:** 0.5 person-day  
**Disciplines:** Contract  
**Dependencies:** S3-04

Tasks:

- Implement exact deadline boundary.
- Restrict to buyer and `Funded`.
- Refund gross and decrease liability atomically.
- Add before/equal/after and race tests.

Acceptance:

- Before deadline fails.
- At/after deadline succeeds only for the buyer while `Funded`.
- Accepted/refund-pending/terminal calls fail.

Evidence:

- Timestamp boundary and payout snapshots.

## S3-10 — Complete stable typed events and errors

**Priority:** P0  
**Estimate:** 0.75 person-day  
**Disciplines:** Contract, Stellar  
**Dependencies:** S3-04 through S3-09

Tasks:

- Implement the catalogs in Sections 17–18.
- Add raw XDR and decoded event snapshots.
- Add TypeScript error and event decoders.
- Ensure failed calls emit no lifecycle event.

Acceptance:

- Every successful transition emits one canonical lifecycle event.
- Every contract rejection has stable typed behavior.
- TypeScript tests decode every v1 error/event.

Evidence:

- Rust and TypeScript snapshots.
- Catalog-to-code coverage table.

## S3-11 — Enforce TTL, liability, and terminal invariants

**Priority:** P0  
**Estimate:** 0.75 person-day  
**Disciplines:** Contract, QA  
**Dependencies:** S3-04 through S3-10

Tasks:

- Centralize TTL helpers.
- Cover instance, code, escrow, and liability.
- Add invariant checks on value-moving paths.
- Add terminal immutability and liability-conservation properties.

Acceptance:

- Section 19 passes.
- Liability equals active escrow totals in generated sequences.
- Every terminal path decrements once.
- TTL never changes authorization or deadline behavior.

Evidence:

- TTL tests.
- Property-test seed/report.
- Balance/liability tables.

## S3-12 — Build the security and verification suite

**Priority:** P0  
**Estimate:** 1.5 person-days  
**Disciplines:** Contract, QA  
**Dependencies:** S3-04 through S3-11

Tasks:

- Cover all public functions with `try_` clients.
- Assert exact authorization trees.
- Add transition and boundary matrix.
- Add property tests for arbitrary action sequences.
- Add fuzz targets for value-moving inputs/sequences.
- Convert every found issue into a deterministic regression.
- Record resource use and approved budgets.

Acceptance:

- Section 25 has no P0 gap.
- `mock_all_auths` is not the only authorization evidence.
- No unresolved crash, invariant break, or unauthorized value movement remains.

Evidence:

- Test matrix.
- Fuzz seeds/durations/results.
- Resource report.
- Known-limitations record.

## S3-13 — Prove real SAC behavior on a local network

**Priority:** P0  
**Estimate:** 1.5 person-days  
**Disciplines:** Contract, Stellar, QA  
**Dependencies:** S3-04 through S3-12

Tasks:

- Script clean local network and actor setup.
- Create native-like and issued USDC-like SAC fixtures.
- Establish balances/trustlines/authorization cases.
- Deploy exact candidate WASM.
- Run happy, refund, cancellation, wrong-SAC, and failed-payout flows.
- Compare contract balance with tracked liability after each step.

Acceptance:

- Real WASM and SACs are used.
- Missing/unauthorized trustline or failed payout rolls back atomically.
- Scripts are repeatable from a clean environment.

Evidence:

- Script logs with secrets redacted.
- Transaction hashes/ledgers.
- Before/after balance and liability report.

## S3-14 — Generate and publish the integration contract

**Priority:** P0  
**Estimate:** 1.0 person-day  
**Disciplines:** Stellar, DevOps  
**Dependencies:** S3-01 through S3-13

Tasks:

- Build optimized locked WASM.
- Record size/hash/spec/resource profile.
- Generate bindings from that WASM.
- Compile/test the generated integration surface.
- Deploy the same WASM to testnet.
- Run smoke flows.
- Produce and verify manifest/evidence.

Acceptance:

- WASM, bindings, manifest, contract ID, and evidence identify one version.
- Release verification script fails on any mismatch.
- Testnet smoke is reproducible and visibly testnet-only.

Evidence:

- CI/release artifact.
- Manifest.
- Binding digest/tests.
- Testnet transactions and getter results.

## S3-15 — Run static and mutation analysis

**Priority:** P1  
**Estimate:** 0.5–1.0 person-day  
**Disciplines:** Contract, QA  
**Dependencies:** All P0 contract behavior implemented

Tasks:

- Run agreed Rust static/security checks.
- Run mutation testing over authorization, transitions, arithmetic, and liability.
- Close or document survivors.

Acceptance:

- No unexplained high-severity finding.
- No survivor can remove an authorization, transition, or payout invariant undetected.

Evidence:

- Tool/version/command report.
- Findings and disposition.

## 23. Ten-day execution plan

## Day 1 — Freeze the contract and release environment

- Approve ABI, state machine, threat model, errors, events, and prohibited functions.
- Confirm testnet protocol/SDK/RPC compatibility.
- Re-verify XLM and USDC addresses.
- Install/verify release-capable Stellar CLI in dev and CI.
- Capture network settings and define resource budgets.
- Create S3-01 through S3-15 work items and dependencies.

**Gate:** No value-moving code merges until S3-01 is approved.

## Day 2 — Types, storage, constructor, and getters

- Finish v1 types and storage keys.
- Harden constructor.
- Add version/config/escrow/liability getters.
- Add constructor, storage, TTL-smoke, and exported-ABI tests.

**Gate:** Typed model and constructor are frozen; no unbounded function exists.

## Day 3 — Atomic funding and liability

- Implement checked fee helpers.
- Implement buyer auth, SAC transfer, escrow creation, and liability increment.
- Cover duplicates, assets, amounts, fees, deadlines, hashes, auth, and rollback.

**Gate:** Exact funding succeeds once and failure leaves no partial state.

## Day 4 — Acceptance and shipment

- Implement supplier acceptance.
- Implement shipment commitment.
- Cover deadline, terms, party, transition, and duplicate cases.
- Add events and snapshots.

**Gate:** `Funded → Accepted → Shipped` is fully verified.

## Day 5 — Release and mid-sprint security review

- Implement exact release and liability decrement.
- Cover fee rounding, two transfers, token failure, replay, and terminal immutability.
- Review authorization trees and value conservation.

**Gate:** Happy-path contract promise works in native tests with no P0 review finding.

## Day 6 — Mutual refund

- Implement proposal, approval, rejection, and withdrawal.
- Cover all three active resume states.
- Cover buyer/supplier proposer symmetry and same-party denial.

**Gate:** Full mutual refund works once; rejection/withdrawal restores exact state.

## Day 7 — Timeout cancellation, events, errors, and TTL

- Implement deadline cancellation.
- Complete stable event/error catalogs.
- Complete TTL helpers and archive-oriented tests.
- Add release/refund/cancel races.

**Gate:** All public ABI behavior exists and deterministic tests are green.

## Day 8 — Property, fuzz, snapshot, and resource verification

- Generate arbitrary lifecycle sequences.
- Run fuzz targets and promote failures to regressions.
- Snapshot events and committed ledger state.
- Profile entry points and compare with budgets.
- Run P1 static/mutation checks if P0 is secure.

**Gate:** No unresolved authorization, invariant, arithmetic, or resource-budget defect.

## Day 9 — Real-WASM local network and generated bindings

- Start from a clean local network.
- Deploy SAC fixtures and exact release candidate.
- Run happy/refund/cancel/failure scripts.
- Generate TypeScript bindings.
- Implement/test decoders and release verifier.

**Gate:** Local real-SAC proof is repeatable and artifact identities match.

## Day 10 — Testnet proof, evidence, and freeze

- Build the final optimized locked WASM.
- Deploy the exact artifact to testnet.
- Run scripted smoke flows.
- Verify getters, events, balances, liability, and terminal states.
- Finalize manifest, evidence, known limitations, and runbook.
- Obtain Product, Contract/Security, QA, Stellar, and DevOps sign-off.

**Gate:** Sprint exit checklist is entirely green or sprint does not close.

## 24. Test fixtures

Deterministic fixtures must include:

- Buyer address.
- Supplier address.
- Alternate wrong-party address.
- Treasury address.
- Contract address.
- Native/XLM SAC.
- Issued USDC-like SAC.
- Unsupported SAC.
- Authorized and unauthorized/trustline-failure token actors.
- Zero-fee config.
- Non-zero-fee test config.
- Minimum positive amount.
- Representative XLM-like and USDC-like amounts.
- Maximum safe arithmetic amount.
- Before/equal/after deadline timestamps.
- Unique escrow IDs.
- Duplicate escrow ID.
- Terms, shipment, delivery, and refund hashes.
- All-zero hash.

Secrets:

- Are generated locally or stored through approved CLI identity/CI secret mechanisms.
- Never enter committed fixtures.
- Never appear in test output, screenshots, evidence, or deployment manifests.

## 25. Verification plan

### 25.1 Per-function unit tests

Every public function has:

- At least one success test.
- Every typed contract error reachable through `try_` clients.
- Wrong-party behavior.
- Invalid-state behavior.
- TTL behavior.
- Event behavior.
- Unchanged-state/balance assertions on failure.

### 25.2 Authorization tests

Assert exact authorization trees for:

- Buyer create-and-fund plus nested SAC transfer.
- Supplier acceptance.
- Supplier shipment.
- Buyer release.
- Buyer- and supplier-proposed refunds.
- Opposite-party refund approval/rejection.
- Proposer withdrawal.
- Buyer timeout cancellation.
- Contract-originated SAC release/refund/cancel transfers.

`mock_all_auths` may support non-auth tests but cannot satisfy the authorization acceptance gate.

### 25.3 Boundary matrix

Required boundaries:

- Amount: negative, zero, one, representative, maximum safe, overflow attempt.
- Fee: zero, one, cap, cap + 1, 10,000, multiplication overflow.
- Parties: distinct, same, wrong actor.
- Assets: XLM, USDC, unsupported, duplicate constructor asset.
- Deadline: past, now, one second/ledger unit ahead, exact expiry, after expiry.
- Hash: matching, mismatching, zero.
- IDs: new, duplicate, missing.
- State: every function from every status.
- Repetition: every successful call repeated.

### 25.4 Property tests

Generate valid and invalid action sequences and assert:

- Only allowed transitions occur.
- Terminal state never changes.
- At most one terminal payout succeeds.
- Supplier plus treasury payout equals gross on release.
- Buyer payout equals gross on refund/cancellation.
- Liability equals sum of non-terminal escrow gross amounts.
- Contract balance is never below liability.
- Refund rejection/withdrawal restores exact prior state.
- Immutable fields never change.
- A failed action changes no financial state.

Persist failing seeds and add a named deterministic regression for each discovered defect.

### 25.5 Fuzz targets

P0 targets:

- `create_and_fund` validation/arithmetic inputs.
- Arbitrary lifecycle action sequences.
- Refund proposer/responder/hash combinations.
- Timestamp boundaries.
- Fee and payout arithmetic.

Record:

- Tool and version.
- Target.
- Corpus/seed.
- Duration or iteration count.
- Crash/invariant results.
- Regression link.

### 25.6 Event and state snapshots

For each success transition:

- Raw event XDR.
- Decoded event.
- Escrow getter.
- Relevant liability getter.
- Contract and participant token balances.
- Authorization tree where applicable.

Snapshots must be reviewed when intentionally changed; they are not blindly regenerated.

### 25.7 Real-SAC local integration

Required flows:

- XLM-like fund → accept → ship → release.
- USDC-like fund → accept → ship → release.
- Mutual refund from each active state.
- Expired-unaccepted cancellation.
- Unsupported SAC.
- Insufficient balance.
- Missing/unauthorized trustline where applicable.
- Failed supplier or treasury payout.
- Duplicate funding.
- Release/refund/cancel race.
- Contract balance versus liability across multiple escrows/assets.

### 25.8 Resource budgets

On Day 1, record live testnet transaction, event, storage, and WASM limits in a versioned resource-budget file.

P0 policy:

- No entry point exceeds 50% of any applicable live per-transaction network limit.
- Happy non-terminal transitions target no more than 25%.
- Terminal two-transfer release targets no more than 35%.
- Event and ledger I/O remain bounded by the fixed v1 types.
- Release-candidate resource use may not regress more than 10% from the approved Day 8 baseline without review.
- Optimized WASM must be produced by the recorded release-capable CLI.

If a target is infeasible, Architecture and Contract review must set and justify a new explicit ceiling before release.

### 25.9 Testnet smoke

Using the exact manifest WASM:

- Deploy constructor config.
- Confirm contract/version/config getters.
- Complete one release flow.
- Complete one mutual refund.
- Complete one timeout cancellation.
- Execute one unauthorized/invalid call.
- Verify terminal state, events, balances, liability, transaction hashes, and ledgers.
- Regenerate or verify bindings against the deployed artifact.

Testnet smoke is not a substitute for local failure/race tests.

## 26. Quality commands

Required baseline gates:

```powershell
cargo fmt --manifest-path contracts/Cargo.toml --all -- --check
cargo clippy --manifest-path contracts/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path contracts/Cargo.toml --lib
stellar contract build --manifest-path contracts/Cargo.toml --locked --optimize
pnpm --filter @repo/stellar format:check
pnpm --filter @repo/stellar lint
pnpm --filter @repo/stellar typecheck
pnpm --filter @repo/stellar test
```

Release/build scripts must add:

- Fuzz/property gate.
- Local real-SAC smoke.
- Generated-binding drift check.
- WASM/spec/hash verification.
- Resource-budget check.
- Testnet smoke when explicitly enabled in the release environment.

On Windows PowerShell systems where `.ps1` execution is disabled, use `pnpm.cmd` rather than changing machine execution policy solely for this repository.

Never place a testnet secret directly in a command, package script, log, or committed file.

## 27. Security review checklist

- [ ] No mutable initialization or configuration entry point.
- [ ] No public upgrade path.
- [ ] No admin/rescue/arbitrary transfer path.
- [ ] Constructor asset list is bounded and unique.
- [ ] Testnet release contains only approved XLM and USDC SACs.
- [ ] Every actor is matched to a snapshot before effect.
- [ ] Exact authorization trees are tested.
- [ ] Every amount is positive integer base units.
- [ ] Every arithmetic operation that may overflow/underflow is checked.
- [ ] Fee is capped, snapshotted, and conserved.
- [ ] Terms and refund hashes must match exactly.
- [ ] Required hashes reject all zero.
- [ ] Same-party refund approval is impossible.
- [ ] Terminal states are immutable.
- [ ] Exactly one terminal payout can succeed.
- [ ] Liability changes exactly once per funding/terminal path.
- [ ] Contract balance is never below liability.
- [ ] Failed token calls roll back state, liability, and events.
- [ ] Deadline uses ledger timestamp with an unambiguous boundary.
- [ ] TTL is not a deadline or authorization rule.
- [ ] No unbounded query or stored collection.
- [ ] No PII/commercial text in state, logs, events, snapshots, or manifests.
- [ ] WASM, source, bindings, manifest, and deployed contract identity agree.
- [ ] Test and deployment secrets are absent from the repository and evidence.
- [ ] Mainnet use is explicitly blocked.

## 28. Risks and controls

| Risk | Probability | Impact | Control |
|---|---|---|---|
| ABI changes after UI integration | Medium | High | Freeze Day 1; generated bindings; manifest; reopen full review on change |
| Wrong testnet asset | Low/Medium | Critical | Re-verify authoritative issuer/SAC; immutable allowlist; manifest |
| Nested auth misunderstood | Medium | Critical | Exact auth-tree assertions and real-SAC tests |
| Payout/liability arithmetic defect | Medium | Critical | Checked math, properties, boundary tests, balance/liability comparison |
| Refund race creates duplicate payout | Low | Critical | Serialized state machine, terminal immutability, race/property tests |
| Failed token transfer leaves partial state | Low/Medium | Critical | Transaction atomicity tests using real failed SAC calls |
| TTL/archive makes funds inaccessible | Medium | High | Hot-path extension, keeper contract, archive/restore runbook/tests |
| Testnet reset invalidates deployment | Medium | Medium | Repeatable deploy/smoke scripts; manifest history; reset runbook |
| CLI/SDK/protocol drift | Medium | High | Version capture and compatibility gate before build/deploy |
| WASM not actually optimized | Observed | Medium | Release-capable CLI required; verifier checks build output and hash |
| Fuzz/static tools unavailable on Windows | Medium | Medium | Run stable CI/Linux job; preserve deterministic regressions locally |
| Mainnet pressure before liveness policy | Medium | Critical | Testnet-only labels and explicit release blocker |
| Surplus token sent to contract | Low | Medium | Liability excludes it; no rescue in v1; document limitation |
| One engineer exceeds capacity | Medium | High | Add reviewers/support or extend calendar; never cut P0 controls |

## 29. Definition of done

Every completed item:

- Meets its detailed acceptance criteria.
- Preserves the frozen ABI or records an approved reopen decision.
- Uses typed bounded contract values.
- Has proportional unit/integration/property/security evidence.
- Asserts failure leaves financial state unchanged.
- Has no secret or PII leakage.
- Passes formatting, lint/static, test, build, binding, and artifact gates.
- Updates contract documentation and evidence.

Financial actions additionally:

- Use exact integer units.
- Require the correct snapshotted actor.
- Simulate successfully before testnet submission.
- Save transaction hash/ledger evidence.
- Confirm final state through a getter.
- Demonstrate idempotency or repeated-call failure.
- Reconcile token balances with tracked liability.

## 30. Sprint exit checklist

### Contract and ABI

- [ ] S3-01 through S3-14 are complete.
- [ ] Public ABI exactly matches Section 13.
- [ ] Types match Section 12.
- [ ] Stable errors preserve codes 1–8 and add reviewed codes.
- [ ] Stable events are implemented and decoded.
- [ ] No prohibited public function exists.

### Lifecycle and value

- [ ] Funding succeeds once for both allowed asset fixtures.
- [ ] Acceptance requires the exact supplier and terms.
- [ ] Shipment requires the exact supplier and a commitment hash.
- [ ] Release requires the buyer and pays exact net/fee.
- [ ] Mutual refund requires two different parties and matching terms.
- [ ] Rejection/withdrawal restores exact prior state.
- [ ] Timeout cancellation uses the exact deadline boundary.
- [ ] Terminal states cannot move again.
- [ ] Liability and contract balances reconcile.

### Verification

- [ ] Every function and typed error has a `try_` client test.
- [ ] Exact authorization trees pass.
- [ ] Boundary and transition matrices pass.
- [ ] Property tests pass with recorded seeds.
- [ ] Fuzz targets complete their agreed P0 run.
- [ ] Event/state/auth snapshots are reviewed.
- [ ] TTL/archive behavior passes.
- [ ] Resource budgets pass.
- [ ] Local real-SAC happy/refund/cancel/failure/race suites pass.

### Release integration

- [ ] Optimized locked WASM is produced with no optimization-skipped warning.
- [ ] Release WASM size and hash are recorded.
- [ ] Bindings are generated from that exact WASM.
- [ ] TypeScript bindings/decoders compile and test.
- [ ] Testnet deployment uses that exact WASM.
- [ ] Testnet smoke passes.
- [ ] Manifest verifier reports no mismatch.

### Operations and evidence

- [ ] Deployment and reset/recovery runbooks are usable by another engineer.
- [ ] Evidence contains no secrets or unnecessary PII.
- [ ] Known limitations and mainnet blockers are current.
- [ ] Product, Contract/Security, QA, Stellar, and DevOps sign off.

Sprint 3 does not close with any unresolved unauthorized value movement, duplicate payout, liability mismatch, unbounded operation, ABI/artifact mismatch, PII exposure, or P0 security defect.

## 31. Required review evidence

Create `docs/evidence/sprint-03/README.md` as the index.

Required evidence:

- Baseline and final tool versions.
- Approved ABI/state-machine version.
- Threat-model review.
- Exported-function/spec report.
- Rust test summary.
- Authorization-tree snapshots.
- Property/fuzz summary and seeds.
- Event XDR and decoded snapshots.
- Ledger-state snapshots.
- Local-network setup and smoke transcript.
- Before/after actor, contract, and liability balances.
- Failed-transfer rollback evidence.
- Resource/WASM profile and budget comparison.
- Optimized WASM SHA-256 and size.
- Generated-binding digest and drift result.
- Testnet deployment transaction, ledger, and contract ID.
- Testnet release/refund/cancellation transaction evidence.
- Deployment manifest verification.
- Known limitations and mainnet blockers.
- Final sign-offs.

Logs must redact secrets and RPC credentials. Public addresses, contract IDs, transaction hashes, and ledgers are expected evidence on testnet.

## 32. Sprint closure decision

### Complete

Use only when:

- All P0 exit checks are green.
- The local and testnet proofs use one exact artifact.
- No P0 defect or unexplained invariant mismatch remains.
- Later sprints can consume generated bindings without changing the ABI.

### Conditional close

Allowed only for:

- An explicitly approved P1 static/mutation item.
- A non-security documentation polish item with owner/date.

Conditional close is not allowed for ABI, auth, token, payout, liability, TTL, real-SAC, optimized artifact, binding, manifest, or testnet proof gaps.

### Not complete

Use when:

- Any P0 item or evidence is missing.
- Optimization is skipped for the release artifact.
- The deployed WASM differs from generated bindings or manifest.
- Any authorization, payout, liability, terminal, or rollback uncertainty remains.
- The demo depends on mocked tokens or manual state correction.

## 33. Handoff to later sprints

Later sprints may assume:

- Contract v1 ABI is frozen and versioned.
- Approved testnet XLM/USDC and release contract IDs come from validated config/manifest.
- Generated TypeScript bindings are the only integration ABI.
- Contract states, events, errors, and getters are stable.
- Amounts are integer base units.
- Terms/refund/shipment/delivery values enter the contract as opaque `BytesN<32>` commitments.
- Contract status is authoritative for held funds.
- Submitted transactions are not terminal until confirmed and reconciled.
- Release/refund/cancel are exact and idempotent by state.

Later sprints still own:

- Canonical commercial-document serialization and domain-separated hashing.
- Transaction-review UI.
- Wallet signing and user rejection/retry states.
- Convex submission records, event indexing, reconciliation, notifications, audit, and dashboards.
- Business-facing explanations of hashes and finality.
- Monitoring/keeper jobs and operational alerts.

Sprint 4 procurement work may create agreement inputs but must not call or silently change contract v1. Sprint 6 funding integration must consume the generated bindings and deployment manifest.

## 34. Elliot start checklist

Before coding:

- [ ] Read this document and the Sprint 3 section of the master sprint plan.
- [ ] Read the contract section of the implementation plan.
- [ ] Inspect `contracts/escrow/src/lib.rs` and current snapshots.
- [ ] Inspect `packages/stellar/src/config.ts`, `contracts.ts`, `events.ts`, and amount helpers.
- [ ] Confirm baseline tests/build remain green.
- [ ] Confirm the authoritative plan supersedes the old Sprint 2 procurement handoff.
- [ ] Create S3-01 through S3-15 work items.
- [ ] Name Day 1, Day 5, and Day 10 reviewers.
- [ ] Resolve the release-capable Stellar CLI optimization gap.
- [ ] Re-verify testnet protocol and asset configuration.
- [ ] Freeze S3-01 before value-moving code.
- [ ] Add exact auth and multi-asset fixtures before implementing funding.
- [ ] Keep generated bindings derived from WASM.
- [ ] Keep P1 work behind every P0 verification gate.

When uncertain, preserve the chain:

```text
reviewed config
→ snapshotted parties/asset/amount/fee/terms
→ exact actor authorization
→ allowed state transition
→ atomic token and liability effect
→ typed event
→ getter-confirmed state
→ artifact-linked evidence
```

Do not solve uncertainty with an administrator backdoor, mutable config, browser-trusted value, database correction, or unreviewed ABI change.

## 35. Implementation references

Local sources of truth:

- [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)
- [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)
- [Sprint 0 Foundation Plan](./Movix-Sprint-00-Foundation-Detailed.md)
- `contracts/escrow/src/lib.rs`
- `contracts/escrow/src/test.rs`
- `contracts/escrow/Cargo.toml`
- `packages/stellar/src/config.ts`
- `packages/stellar/src/amounts.ts`
- `packages/stellar/src/contracts.ts`
- `packages/stellar/src/events.ts`

Authoritative Stellar references to re-check during implementation:

- [Stellar CLI manual](https://developers.stellar.org/docs/tools/cli/stellar-cli)
- [Generate TypeScript bindings](https://developers.stellar.org/docs/build/apps/guestbook/bindings)
- [Stellar Asset Contract deployment](https://developers.stellar.org/docs/tools/cli/cookbook/deploy-stellar-asset-contract)
- [Contract lifecycle](https://developers.stellar.org/docs/tools/cli/cookbook/contract-lifecycle)
- [Analyze contract cost and efficiency](https://developers.stellar.org/docs/build/guides/fees/analyzing-smart-contract-cost)
- [Fully typed contracts](https://developers.stellar.org/docs/learn/fundamentals/contract-development/types/fully-typed-contracts)

Framework behavior, live network limits, protocol versions, and asset addresses must be re-checked at execution time. Documentation examples are not substitutes for release manifest verification.

## 36. Sign-off

| Discipline | Owner | Status | Date | Notes |
|---|---|---|---|---|
| Product | Nicole / Chris | Pending | — | Scope, deadline, fee, and mainnet blockers |
| Architecture | TBD | Pending | — | ABI, trust boundary, storage, liveness |
| Contract/Security | Elliot / reviewer TBD | Pending | — | Authorization, invariants, threat model |
| Stellar | Elliot / TBD | Pending | — | SAC, bindings, testnet proof |
| QA | TBD | Pending | — | Verification matrix and evidence |
| DevOps | TBD | Pending | — | Optimized build, CI, manifest, deployment |

Final Product sign-off requires:

- The sprint goal and demo are achieved.
- Every P0 exit item has inspectable evidence.
- The contract has no hidden custody or mutable-configuration path.
- The exact release artifact is locally and remotely reproducible.
- The product remains visibly testnet-only.
- Later work can proceed without inventing settlement rules.
