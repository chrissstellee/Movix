# Movix Escrow Contract v1 ABI

| Metadata                         | Value                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Status                           | As-built working-tree ABI and optimized spec verified; commit-bound release pending |
| Sprint items                     | S3-01 through S3-11, S3-14                                                          |
| Contract version                 | `1`                                                                                 |
| Escrow schema version            | `1`                                                                                 |
| Requirements authority           | `docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md`                                |
| Source commit                    | Pending release capture                                                             |
| Last documentation review        | 2026-07-28                                                                          |
| Last implementation verification | 2026-07-28 native tests and optimized spec inspection                               |
| Required reviewers               | Product, Architecture, Contract/Security, QA                                        |
| Approval                         | Pending                                                                             |
| Evidence index                   | `docs/evidence/sprint-03/README.md`                                                 |

This document describes the frozen, as-built interface and behavior for the
testnet-only Movix escrow contract. Native contract tests pass and the optimized
WASM spec exports exactly the 14 listed functions with no prohibited entry
point. Release conformance remains pending until the artifact is commit-bound,
the manifest and testnet proof are complete, and reviewer approvals are linked
from the evidence index.

## Design boundary

One immutable contract instance serves many escrow IDs. Each escrow holds one
allowlisted asset and one gross integer amount. Funding, release, refund, and
cancellation are full and atomic.

The contract is authoritative for custody, lifecycle status, immutable
financial snapshots, liability, and terminal payout. It is not authoritative
for organizations, commercial documents, shipment truth, identity, or dispute
adjudication.

The v1 interface has no mutable initialization, configuration, upgrade, pause,
rescue, administrative transfer, generic execution, or list function. In
particular, these names are prohibited:

- `initialize`, `set_config`, `set_treasury`, and `set_fee`
- `add_asset` and `remove_asset`
- `upgrade`, `pause`, and `rescue`
- `admin_transfer`
- `list_escrows` and `list_user_escrows`
- any generic call or execute function

## Constants and exported types

| Constant                |    Value |
| ----------------------- | -------: |
| `CONTRACT_VERSION`      |      `1` |
| `ESCROW_SCHEMA_VERSION` |      `1` |
| `BPS_DENOMINATOR`       | `10_000` |
| `MAX_SUPPORTED_ASSETS`  |      `2` |

All exported values must be bounded Soroban-compatible types.

### `TtlConfig`

```text
threshold: u32
extend_to: u32
```

`threshold` must be positive and `extend_to` must be greater than
`threshold`. Deployment must also verify both values against the live network
limits. The same policy applies to instance, code, escrow, and liability TTLs.

### `Config`

```text
treasury: Address
supported_sac_addresses: Vec<Address>
max_fee_bps: u32
ttl: TtlConfig
```

The treasury cannot be the contract itself. The asset list contains one or two
unique SAC addresses, and `max_fee_bps` cannot exceed `10_000`. Configuration
is set only by `__constructor` and is immutable afterward. The Sprint 3 release
manifest must identify the independently verified testnet XLM and USDC SACs.

### `Status`

```text
Funded
Accepted
Shipped
RefundPending
Released
Refunded
Cancelled
```

`Released`, `Refunded`, and `Cancelled` are terminal.

### `Escrow`

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

The schema version, ID, parties, token, amounts, fee fields, creation time,
deadline, and terms hash are immutable after funding. Shipment and delivery
hashes are each set once. Pending refunds carry the prior active state, proposer,
and refund terms hash. Rejection or withdrawal clears all pending-refund fields.
Approval clears only `resume_status` and retains the approved proposer and hash
as terminal audit data. Every successful transition records the ledger
timestamp in `last_updated_at`.

Commitment hashes are opaque `BytesN<32>` values. All-zero values are invalid.
They are party commitments, not proof of shipment or delivery. PII, legal text,
addresses, invoices, line items, files, and raw commercial JSON must not enter
contract state or events.

### Storage keys

```text
Config
Escrow(BytesN<32>)
Liability(Address)
```

`Config` uses instance storage. Each escrow and each active token liability has
its own persistent entry. There is no aggregate escrow vector or user index.

## Public interface

| Function                                                                              | Return   | Authorization          | Contract effect                                            |
| ------------------------------------------------------------------------------------- | -------- | ---------------------- | ---------------------------------------------------------- |
| `__constructor(config)`                                                               | none     | deployment transaction | Validate and store immutable configuration                 |
| `get_version()`                                                                       | `u32`    | public                 | Return `1`                                                 |
| `get_config()`                                                                        | `Config` | public                 | Return immutable bounded configuration                     |
| `get_escrow(id)`                                                                      | `Escrow` | public                 | Return one escrow or `EscrowNotFound`                      |
| `get_liability(token)`                                                                | `i128`   | public                 | Return liability for a supported token, defaulting to zero |
| `create_and_fund(id, buyer, supplier, token, amount, fee_bps, accept_by, terms_hash)` | `Escrow` | buyer                  | Transfer gross amount in and create `Funded`               |
| `accept(id, supplier, terms_hash)`                                                    | `Escrow` | snapshotted supplier   | `Funded` to `Accepted` before deadline                     |
| `mark_shipped(id, supplier, shipment_hash)`                                           | `Escrow` | snapshotted supplier   | `Accepted` to `Shipped`                                    |
| `confirm_delivery(id, buyer, delivery_hash)`                                          | `Escrow` | snapshotted buyer      | `Shipped` to `Released`; exact payout                      |
| `propose_refund(id, proposer, refund_terms_hash)`                                     | `Escrow` | buyer or supplier      | Active state to `RefundPending`                            |
| `approve_refund(id, approver, refund_terms_hash)`                                     | `Escrow` | opposite party         | `RefundPending` to `Refunded`; full buyer refund           |
| `reject_refund(id, approver, refund_terms_hash)`                                      | `Escrow` | opposite party         | Restore prior active state                                 |
| `withdraw_refund(id, proposer, refund_terms_hash)`                                    | `Escrow` | original proposer      | Restore prior active state                                 |
| `cancel_unaccepted(id, buyer)`                                                        | `Escrow` | snapshotted buyer      | Expired `Funded` to `Cancelled`; full buyer refund         |

## State machine

| From                               | Operation and guard                                                                              | To                 | Token and liability effect                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------- |
| none                               | Create with unique ID, distinct parties, allowed asset, positive amount, valid fee/deadline/hash | `Funded`           | buyer to contract; liability `+gross`             |
| `Funded`                           | Supplier accepts matching terms while `now < accept_by`                                          | `Accepted`         | none                                              |
| `Funded`                           | Buyer cancels while `now >= accept_by`                                                           | `Cancelled`        | contract to buyer; liability `-gross`             |
| `Accepted`                         | Supplier submits non-zero shipment hash                                                          | `Shipped`          | none                                              |
| `Shipped`                          | Buyer submits non-zero delivery hash                                                             | `Released`         | contract to supplier/treasury; liability `-gross` |
| `Funded`, `Accepted`, or `Shipped` | Either party proposes a non-zero refund hash                                                     | `RefundPending`    | none                                              |
| `RefundPending`                    | Opposite party approves matching hash                                                            | `Refunded`         | contract to buyer; liability `-gross`             |
| `RefundPending`                    | Opposite party rejects matching hash                                                             | prior active state | none                                              |
| `RefundPending`                    | Original proposer withdraws matching hash                                                        | prior active state | none                                              |

Every unlisted transition fails without changing lifecycle state, liability,
token balances, or lifecycle events. Serialized races are decided by the first
successful state change. A later conflicting or repeated call must fail.

The deadline boundary is intentionally exclusive for acceptance and inclusive
for cancellation: acceptance requires `now < accept_by`; cancellation requires
`now >= accept_by`.

## Function invariants

### Construction and reads

The constructor validates the treasury, bounded unique assets, fee cap, and TTL
policy before storing configuration. A failed constructor leaves no
configuration and emits no event. `get_liability` returns zero only for a
supported token with no liability; it rejects arbitrary tokens.

Every public call loads configuration and conditionally extends instance and
code TTL. Escrow reads and mutations extend the escrow entry. Value-moving
calls extend the relevant liability entry, and liability reads extend an
existing entry. TTL never authorizes a party, determines a deadline, or
triggers a lifecycle transition.

### Funding

`create_and_fund` rejects duplicate IDs, same-party escrows, unsupported assets,
non-positive amounts, excessive fees, non-future deadlines, and zero hashes.
After checked fee arithmetic and buyer authorization, it transfers exactly the
gross amount to the contract, increases liability by the same amount, stores
the complete snapshot, extends TTLs, and emits `Funded`. All effects are atomic.

### Acceptance, shipment, and release

Acceptance requires the snapshotted supplier, exact funded terms hash, and an
unexpired `Funded` escrow. Shipment requires the same supplier, `Accepted`
status, and a non-zero shipment hash.

Release requires the snapshotted buyer, `Shipped` status, and a non-zero
delivery hash. It atomically pays:

```text
fee_amount = floor(gross_amount * fee_bps / 10_000)
net_amount = gross_amount - fee_amount
supplier payout = net_amount
treasury payout = fee_amount, only when fee_amount > 0
```

Checked arithmetic must prove `fee + net == gross`. Release reduces liability
by gross exactly once and must leave the contract balance at least equal to the
remaining token liability.

### Refund and cancellation

A refund proposal snapshots the exact active state. Only the opposite party can
approve or reject it; only the original proposer can withdraw it; every
response must carry the matching refund hash. Approval refunds the full gross
amount to the buyer with no fee and reduces liability once. Rejection and
withdrawal move no tokens and restore the exact prior state.

Cancellation is available only to the snapshotted buyer while status is exactly
`Funded` and the deadline has been reached. It returns the full gross amount,
charges no fee, and reduces liability once.

## Liability and conservation

For each configured token:

```text
liability = sum(gross_amount for every non-terminal escrow using token)
contract token balance >= liability
```

Funding increases liability once. Acceptance, shipment, and pending-refund
operations do not change it. Release, approved refund, or cancellation
decreases it exactly once. Liability cannot become negative. Tokens sent
directly to the contract are surplus: they do not increase liability and cannot
be rescued through v1.

## Generated binding policy

The optimized release WASM is the only integration ABI. TypeScript bindings
must be generated from that exact file and must not be manually maintained:

```powershell
stellar contract bindings typescript `
  --wasm contracts/target/wasm32v1-none/release/movix_escrow.wasm `
  --output-dir packages/stellar/generated/escrow `
  --overwrite
```

Any ABI change requires contract review, a new optimized WASM and hash,
regenerated bindings, a manifest update, and an explicit version decision.

## Acceptance traceability

| Requirement                                              | Sprint item  | Required evidence                                                    |
| -------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Frozen types, functions, transitions, and prohibited API | S3-01, S3-02 | ABI approval and exported-spec report                                |
| Constructor and bounded reads                            | S3-03, S3-05 | Unit tests, WASM spec, TTL snapshots                                 |
| Atomic funding and liability increase                    | S3-04        | Exact auth tree, SAC transfer, rollback and balance evidence         |
| Acceptance and shipment                                  | S3-06        | Transition, deadline, hash, auth, event tests                        |
| Exact release                                            | S3-07        | Payout, conservation, liability, rollback and replay evidence        |
| Mutual refund protocol                                   | S3-08        | Both proposer paths, all active states, stale-hash and race evidence |
| Timeout cancellation                                     | S3-09        | Before/equal/after boundary and payout evidence                      |
| Stable errors and events                                 | S3-10        | Catalog coverage, raw XDR and decoded snapshots                      |
| TTL, liability, and terminal invariants                  | S3-11        | Property, archive/restore, multi-escrow evidence                     |
| Generated integration ABI                                | S3-14        | WASM/binding digests, drift check, manifest verification             |

## Known limitations and release blockers

- v1 has no unilateral liveness path after shipment if the buyer refuses both
  release and mutual refund.
- v1 has no dispute resolver, partial settlement, automatic release, rescue, or
  privileged recovery.
- Archived state and code require an operational restoration procedure.
- Directly transferred surplus tokens cannot be withdrawn.
- This release is testnet-only.
- Mainnet remains blocked on an explicit liveness policy, external security
  review, legal review, and named incident ownership.
- Release remains blocked until the release-capable CLI, live limits, approved
  SACs, exact artifact identity, testnet proof, and all required approvals are
  recorded.
