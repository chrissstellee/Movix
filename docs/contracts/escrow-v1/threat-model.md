# Movix Escrow Contract v1 Threat Model

| Metadata                  | Value                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| Status                    | As-built controls locally verified; external evidence and approval pending |
| Sprint items              | S3-01, S3-03, S3-04, S3-06 through S3-13                                   |
| Contract/schema version   | `1` / `1`                                                                  |
| Requirements authority    | `docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md`                       |
| Contract source commit    | `a9d09f9bf4890d6093803be6d1a62fe5d460a2b2`                                 |
| Last documentation review | 2026-07-28                                                                 |
| Last control verification | 2026-07-28 working tree                                                    |
| Required reviewers        | Architecture, Contract/Security, QA, Stellar, DevOps                       |
| Approval                  | Pending                                                                    |
| Evidence index            | `docs/evidence/sprint-03/README.md`                                        |

## Scope and security objective

This model covers the testnet-only pooled escrow contract, its SAC calls,
generated integration ABI, release artifacts, deployment process, and
contract-specific evidence. The security objective is to ensure that only the
snapshotted parties can cause allowed transitions and that every terminal path
moves the exact value once while preserving per-token liability.

Commercial identity, document truth, shipment truth, dispute adjudication,
browser UX, and Convex reconciliation are outside the contract's trust scope.
Mainnet security is explicitly out of scope.

## Assets to protect

- Escrowed token principal.
- Immutable buyer, supplier, token, gross amount, fee, deadline, and terms.
- Lifecycle and terminal-state integrity.
- Per-token liability and its reconciliation with contract balances.
- Exact authorization intent, including nested SAC authorization.
- Release WASM, generated bindings, deployment manifest, and artifact identity.
- Test and deployment secrets.
- PII and commercial data that must remain off-chain.

## Actors and trust boundaries

| Actor or system     | Trusted for                                                                         | Not trusted for                                              |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Buyer               | Funding, delivery confirmation, refund participation, eligible timeout cancellation | Asset allowlist, changing snapshots, bypassing state         |
| Supplier            | Matching acceptance, shipment commitment, refund participation                      | Releasing funds, changing snapshots, self-approving a refund |
| Treasury            | Receiving a snapshotted release fee                                                 | Authorization, configuration, or movement of principal       |
| Escrow contract     | Authorization checks, lifecycle, atomic token effects, liability                    | Identity, commercial truth, physical shipment, disputes      |
| SAC/token contract  | Balances, transfer authorization, token behavior                                    | Movix lifecycle semantics                                    |
| Browser/wallet      | Presenting and signing a reviewed transaction                                       | Trusted asset, amount, contract ID, status, or finality      |
| Convex              | Commercial records and later searchable projections                                 | Custody state or terminal payout                             |
| Deployment operator | Supplying reviewed immutable configuration                                          | Post-deployment recovery, rescue, or reconfiguration         |
| Testnet/RPC         | Pilot execution and queries                                                         | Mainnet readiness or permanent availability                  |

No privileged actor can override participant authorization, mutate an escrow,
release/refund/cancel administratively, or withdraw surplus in v1.

## Threats, controls, and evidence

Working-tree results are linked from the Sprint 3 evidence index. They are not
immutable release approval.

| Threat                                        | Required control                                                                 | Evidence gate                                   | Status                |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------- |
| Unauthorized funding                          | Match buyer argument, then `buyer.require_auth`; assert nested SAC authorization | Exact auth-tree test                            | Working-tree verified |
| Unauthorized transition                       | Compare actor with snapshotted party before authorization or effect              | Wrong-party test for every entry point          | Working-tree verified |
| Token substitution                            | Immutable bounded allowlist; reject before transfer                              | Wrong-SAC unit and local-SAC tests              | Working-tree verified |
| Duplicate funding                             | Persistent unique escrow key and transaction atomicity                           | Duplicate and serialized-submission tests       | Working-tree verified |
| Buyer equals supplier                         | Reject creation                                                                  | Typed error and unchanged balances/state        | Working-tree verified |
| Arithmetic overflow or underflow              | Positive `i128`; checked multiply, add, and subtract                             | Boundaries and generated sequences              | Working-tree verified |
| Fee overcharge                                | Config/request caps, immutable fee snapshot, conservation                        | Cap and rounding tests                          | Working-tree verified |
| Altered acceptance terms                      | Immutable terms hash and exact supplier-supplied match                           | Hash-mismatch test                              | Working-tree verified |
| Early cancellation                            | Ledger timestamp and exact `Funded` state                                        | Before/equal/after boundary tests               | Working-tree verified |
| Self-approved refund                          | Snapshot proposer and require opposite party                                     | Buyer/supplier self-approval tests              | Working-tree verified |
| Stale refund response                         | Require pending state, proposer role, and exact hash                             | Approve/reject/withdraw stale-hash tests        | Working-tree verified |
| Double payout                                 | Terminal immutability and one liability decrement                                | Repeat, race, and arbitrary-sequence properties | Working-tree verified |
| Release during refund                         | `RefundPending` disallows release/cancellation                                   | Transition and serialized-race tests            | Working-tree verified |
| Failed nested transfer leaves partial effects | Soroban transaction atomicity across transfer, storage, liability, event         | Real-SAC rollback evidence                      | Working-tree verified |
| Liability drift                               | Checked per-token accounting and balance comparison                              | Every-step and multi-escrow properties          | Working-tree verified |
| Unbounded execution                           | Two assets maximum, single-record getters, no list API                           | Exported ABI and resource report                | Working-tree verified |
| Archived code or state                        | Hot-path TTL extension plus restore runbook                                      | TTL/archive/restore tests                       | Working-tree verified |
| PII disclosure                                | Fixed typed fields/events and prohibited-data review                             | Raw XDR and storage snapshot review             | Pending               |
| Artifact mismatch                             | Link commit, WASM, bindings, manifest, deployment                                | Release verifier and fetched-WASM comparison    | Working-tree verified |
| Operator custody backdoor                     | No admin transfer, rescue, arbitrary call, mutable config, or upgrade            | ABI review and negative checklist               | Pending               |
| Secret disclosure                             | Approved identity/secret stores; redacted logs and manifest                      | Repository/evidence review                      | Pending               |

## Authorization and transaction ordering

For every mutating function, the implementation must:

1. Load the immutable snapshot.
2. Confirm the function is allowed from the current status.
3. Compare the actor argument to the required snapshotted role.
4. Validate hashes, deadlines, amounts, and refund roles.
5. Require authorization from that exact actor.
6. Apply token, liability, state, TTL, and event effects atomically.

Tests must assert exact authorization trees. `mock_all_auths` may support tests
whose subject is not authorization, but it cannot satisfy the authorization
gate.

Ledger serialization defines race outcomes. For release versus refund proposal,
approval versus withdrawal, acceptance versus deadline cancellation, duplicate
funding, and repeated terminal actions, at most one conflicting operation can
succeed. Evidence must include final balances and liability, not only the losing
transaction's error.

## Financial invariants

All amounts are integer base units. No decimal parsing occurs on-chain.

```text
fee = floor(gross * fee_bps / 10_000)
net = gross - fee
fee + net = gross
```

The request fee cannot exceed the immutable configured cap, and the configured
cap cannot exceed `10_000`. Refund and cancellation always return the full
gross amount and charge no fee.

For each configured token:

```text
liability = sum(gross for non-terminal escrows)
contract balance >= liability
```

Funding increments liability once. Only successful release, approved refund, or
cancellation decrements it, once. A failed call changes no financial state.

## Atomicity and external calls

SAC calls are an external trust boundary. Funding must roll back escrow
creation, liability, and events if the buyer transfer fails. Release, refund,
and cancellation must roll back every transfer, liability update, state update,
and event if any nested transfer or invariant check fails.

Mock token movement is insufficient. Required local evidence includes
insufficient balance, authorization/trustline failure where applicable, failed
supplier or treasury payout, and reconciliation across multiple assets and
escrows.

## TTL, archival, and recovery risk

TTL is operational availability policy, not business logic. It must never act
as authorization, a deadline, or an automatic release/refund/cancel mechanism.
Every public call extends instance and code TTL when required; escrow and
liability operations extend their persistent entries.

Tests must cover threshold behavior, instance/code/escrow/liability extension,
archive/restore where supported, explicit timestamp deadlines after restoration,
and terminal replay denial. A later keeper is expected, but is not Sprint 3
contract scope.

Restoration does not authorize state repair. Operators must not use database
changes, manual token corrections, mutable configuration, or an administrator
backdoor to resolve archival or lifecycle uncertainty.

## Privacy and evidence handling

Contract state, events, logs, manifests, and evidence must exclude:

- secret seeds, private keys, JWTs, cookies, RPC credentials, and secret headers;
- raw signed transactions;
- names, emails, postal addresses, or other PII;
- legal or commercial text, line items, invoice data, shipment text, reasons,
  files, and raw commercial JSON.

Public testnet addresses, contract IDs, transaction hashes, and ledger numbers
are expected evidence. Raw XDR may be retained only after confirming it contains
no prohibited data.

## Residual limitations

- After shipment, a non-cooperative buyer can refuse both release and mutual
  refund. v1 has no unilateral liveness or dispute mechanism.
- Direct token transfers can create surplus that v1 cannot rescue.
- Testnet reset or archival can make a deployment temporarily unavailable.
- RPC availability and testnet behavior do not prove mainnet readiness.
- Opaque hashes prove only that a party submitted a commitment.
- v1 intentionally has no upgrade, pause, rescue, or privileged recovery path.

## Release and mainnet blockers

Sprint 3 cannot close while any authorization, token, payout, liability,
terminal-state, rollback, TTL, real-SAC, optimized-artifact, binding, manifest,
or testnet-proof gap remains. It also requires named reviewers and inspectable
evidence.

Mainnet remains blocked until all of the following occur outside Sprint 3:

- an explicit post-shipment liveness policy;
- external contract security review;
- legal review of settlement and custody behavior;
- named incident ownership and operational response;
- a separate mainnet deployment review.

## Review checklist

- [ ] Every public mutator has exact-role and wrong-party tests.
- [ ] Exact nested authorization trees are reviewed.
- [ ] Amount, fee, deadline, hash, state, and repetition boundaries pass.
- [ ] Every terminal path conserves gross and decrements liability once.
- [ ] Failed SAC calls roll back tokens, liability, state, and events.
- [ ] Contract balance is never below tracked liability.
- [ ] No prohibited or unbounded public function exists.
- [ ] TTL and archive/restore evidence does not substitute for business state.
- [ ] Storage and event snapshots contain no prohibited data.
- [ ] Source, optimized WASM, generated bindings, manifest, and deployment agree.
- [ ] Known limitations and testnet-only status are visible.
- [ ] Required discipline approvals are recorded in immutable evidence.
