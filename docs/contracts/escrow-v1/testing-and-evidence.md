# Movix Escrow Contract v1 Testing and Evidence

| Metadata                    | Value                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Status                      | Local, Linux-fuzz, and public-testnet engineering verification passed; approval pending |
| Sprint items                | S3-01 through S3-15                                                                     |
| Contract/schema version     | `1` / `1`                                                                               |
| Requirements authority      | `docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md`                                    |
| Contract source commit      | `a9d09f9bf4890d6093803be6d1a62fe5d460a2b2`                                              |
| Last documentation review   | 2026-07-28                                                                              |
| Last execution verification | 2026-07-28; contract source `a9d09f9bf489`                                              |
| Required reviewers          | Contract/Security, QA, Stellar, DevOps                                                  |
| Approval                    | Pending                                                                                 |
| Evidence index              | `docs/evidence/sprint-03/README.md`                                                     |

The live testnet limits and approved percentage ceilings captured on
2026-07-28 are versioned in `resource-budgets.json`. All 13 callable entry
points were measured against the exact optimized working-tree WASM on a local
network using testnet-like limits and passed their ceilings. Contract-source,
public-testnet lifecycle, fetched-artifact, raw-event-XDR, and Linux fuzz
verification passed.

Every verification claim in this document is backed by the evidence index.
Independent discipline approval is not yet claimed.

## Verification principles

- Test the exact frozen ABI and optimized release artifact.
- Assert final balances and liability, not only returned errors.
- Use exact authorization trees; `mock_all_auths` alone is insufficient.
- Use real WASM and real SAC calls for local value-movement proof.
- Treat all failed actions as atomic: no token, liability, escrow, or lifecycle
  event change.
- Keep getters, events, authorization, ledger state, balances, and liabilities
  mutually consistent.
- Preserve every property/fuzz failure as a named deterministic regression.
- Review snapshots intentionally; do not blindly regenerate them.
- Never commit or publish secrets, credentials, PII, commercial text, or raw
  signed transactions.

## Deterministic fixture matrix

| Fixture        | Required cases                                                                        |
| -------------- | ------------------------------------------------------------------------------------- |
| Actors         | buyer, supplier, wrong party, treasury, contract                                      |
| Assets         | XLM-like SAC, USDC-like SAC, unsupported SAC                                          |
| Token behavior | sufficient/insufficient balance; authorized and unauthorized/trustline-failure actors |
| Configuration  | zero-fee pilot; non-zero-fee test config; one and two unique assets                   |
| Amounts        | negative, zero, one, representative values, maximum safe value, overflow attempt      |
| Fees           | zero, one, cap, cap plus one, `10_000`, multiplication overflow                       |
| Deadlines      | past, now, just ahead, exact expiry, after expiry                                     |
| IDs            | unique, duplicate, missing                                                            |
| Hashes         | terms, shipment, delivery, refund; matching, mismatching, all-zero                    |
| Lifecycle      | every function from every status; every success repeated                              |

Fixture secrets must be generated locally or provided through approved CLI/CI
secret mechanisms. Only public fixture identifiers may enter evidence.

## Per-function tests

Every public function requires:

- at least one success test;
- every reachable typed error through a generated `try_` client;
- wrong-party and invalid-state behavior;
- TTL and event behavior;
- unchanged escrow, balance, liability, and lifecycle-event assertions on
  failure;
- repeated-call behavior after success.

### Function/status matrix

| Function            | Allowed state                 | Primary success proof                            | Required negative focus                                                        |
| ------------------- | ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `__constructor`     | deployment                    | exact config and `Configured`                    | treasury=self, asset count/duplicates, fee cap, TTL                            |
| `get_version`       | any initialized               | returns `1`                                      | absent config behavior where reachable                                         |
| `get_config`        | initialized                   | exact immutable config                           | absent config                                                                  |
| `get_escrow`        | escrow exists                 | exact bounded snapshot                           | missing ID                                                                     |
| `get_liability`     | supported token               | exact value or zero                              | unsupported token                                                              |
| `create_and_fund`   | missing ID                    | transfer, snapshot, liability, `Funded`          | duplicate ID, parties, asset, amount, fee, deadline, hash, auth, token failure |
| `accept`            | `Funded`                      | supplier, matching terms, before deadline        | every other state, wrong party, mismatch, exact expiry                         |
| `mark_shipped`      | `Accepted`                    | supplier and non-zero hash                       | every other state, wrong party, zero hash                                      |
| `confirm_delivery`  | `Shipped`                     | exact net/fee payout and liability decrement     | state, party, hash, arithmetic/invariant, failed payout, replay                |
| `propose_refund`    | `Funded`/`Accepted`/`Shipped` | exact resume state/proposer/hash                 | other states, outsider, zero hash, duplicate proposal                          |
| `approve_refund`    | `RefundPending`               | opposite party, full refund, liability decrement | proposer self-approval, outsider, stale hash, failed transfer, replay          |
| `reject_refund`     | `RefundPending`               | exact restored state, cleared fields             | proposer/outsider, stale hash, replay                                          |
| `withdraw_refund`   | `RefundPending`               | proposer, exact restored state, cleared fields   | counterparty/outsider, stale hash, replay                                      |
| `cancel_unaccepted` | expired `Funded`              | full refund and liability decrement              | too early, every other state, wrong party, failed transfer, replay             |

## Exact authorization tests

Capture and review authorization trees for:

- buyer create-and-fund with nested SAC transfer;
- supplier acceptance and shipment;
- buyer release;
- refund proposed by buyer and supplier;
- opposite-party approval and rejection;
- proposer withdrawal;
- buyer timeout cancellation;
- contract-originated release, refund, and cancellation transfers.

Actor equality must be checked against the snapshot before effect. Contract
`UnauthorizedParty` errors and native authorization failures must remain
distinguishable.

## Boundary and transition tests

Required boundaries:

- amount: negative, zero, one, representative, maximum safe, overflow;
- fee: zero, one, configured cap, cap plus one, `10_000`, multiplication
  overflow, floor rounding;
- parties: distinct, same, correct, wrong;
- assets: both configured SACs, unsupported SAC, duplicate constructor asset;
- deadline: past, current timestamp, one unit ahead, exact expiry, after expiry;
- hash: matching, mismatching, all-zero;
- ID: new, duplicate, missing;
- state: every function from all seven statuses;
- repetition: repeat every successful call.

The exact acceptance/cancellation boundary must be proven:

```text
accept succeeds only when now < accept_by
cancel may succeed when now >= accept_by and status == Funded
```

## Financial and state properties

Generate valid and invalid action sequences and assert:

- only listed transitions occur;
- terminal state never changes;
- no more than one terminal payout succeeds;
- supplier payout plus treasury payout equals gross on release;
- buyer receives gross on refund and cancellation;
- liability equals the sum of gross amounts for non-terminal escrows by token;
- contract balance is never below liability;
- refund rejection and withdrawal restore the exact prior state;
- immutable fields never change;
- every failed action changes no financial state.

Property evidence records tool/version, source commit, environment, seed or
corpus identity, cases/iterations, result, and any deterministic regression.

## Fuzz targets

P0 targets:

- `create_and_fund` validation and arithmetic;
- arbitrary lifecycle action sequences;
- refund proposer/responder/hash combinations;
- timestamp boundaries;
- fee and payout arithmetic.

For each run, record:

| Field               | Required value                             |
| ------------------- | ------------------------------------------ |
| Tool/version        | Actual executable and version              |
| Target              | Exact target name                          |
| Source/artifact     | Commit and candidate WASM where applicable |
| Corpus/seed         | Reproducible identifier without secrets    |
| Duration/iterations | Actual value                               |
| Result              | Pass, invariant failure, or crash          |
| Regression          | Link for every discovered defect           |

Static and mutation analysis are P1 and may run only after every P0 security
gate passes. Lack of P1 tooling cannot excuse a P0 gap.

## Event, state, and authorization snapshots

For every successful transition, record:

- raw event XDR and decoded/normalized event;
- escrow getter and relevant liability getter;
- participant and contract token balances;
- ledger state and transaction identifier;
- exact authorization tree where applicable.

For failed calls, record the error layer and prove no business state, balance,
liability, or lifecycle event changed.

Snapshot names use:

```text
S3-<GROUP>-<SCENARIO>-<commit12>-<environment>-<sequence>
```

Examples of groups are `AUTH`, `EVENT`, `STATE`, `ROLLBACK`, `RESOURCE`,
`LOCAL`, and `TESTNET`. The actual commit prefix and sequence must be captured
at execution time.

## TTL and archive verification

Cover:

- threshold not reached;
- threshold reached and extension performed;
- instance, code, escrow, and liability entries;
- archived/restored fixtures where the environment supports them;
- ledger timestamp remains the deadline source;
- terminal payout cannot replay after restoration.

Document the verified SDK APIs and live testnet TTL bounds. TTL evidence is not
evidence of authorization, shipment, delivery, or lifecycle state.

## Local real-SAC integration

Start from a clean local network and deploy the exact release candidate. Required
flows:

- XLM-like fund, accept, ship, release;
- USDC-like fund, accept, ship, release;
- mutual refund from every active state and with each party as proposer;
- expired-unaccepted cancellation;
- unsupported SAC;
- insufficient balance;
- unauthorized/trustline failure where applicable;
- failed supplier or treasury payout;
- duplicate funding;
- release/refund/cancel races;
- contract balance versus liability across multiple escrows and assets.

Each step must reconcile getters, events, balances, and liability. Mock token
movement cannot satisfy this gate.

## Resource budgets

Record live testnet transaction, event, storage, and WASM limits in a versioned
resource-budget artifact on Day 1.

| Target                        | Required ceiling                                              |
| ----------------------------- | ------------------------------------------------------------- |
| Any entry point               | no more than 50% of an applicable live per-transaction limit  |
| Happy non-terminal transition | target no more than 25%                                       |
| Terminal two-transfer release | target no more than 35%                                       |
| Release-candidate regression  | no more than 10% above approved Day 8 baseline without review |

Event and ledger I/O must remain bounded. The release CLI must actually optimize
the WASM. If a target is infeasible, Architecture and Contract/Security must
approve a new explicit ceiling before release; do not silently weaken the gate.

## Testnet smoke

Using the exact manifest WASM:

1. Deploy reviewed immutable constructor configuration.
2. Confirm version and configuration getters.
3. Complete one release.
4. Complete one mutual refund.
5. Complete one timeout cancellation.
6. Execute one unauthorized or invalid call.
7. Verify terminal states, replay denial, events, balances, liabilities,
   transaction hashes, and ledgers.
8. Verify generated bindings against the deployed interface.

Testnet smoke is not a substitute for local negative, rollback, race, property,
or fuzz tests.

## Quality commands

```powershell
cargo fmt --manifest-path contracts/Cargo.toml --all -- --check
cargo clippy --manifest-path contracts/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path contracts/Cargo.toml --lib
stellar contract build --manifest-path contracts/Cargo.toml --locked --optimize
pnpm.cmd build:contracts
pnpm.cmd contracts:bindings
pnpm.cmd contracts:local:setup
pnpm.cmd contracts:local:smoke
pnpm.cmd contracts:local:negative
pnpm.cmd contracts:resources
pnpm.cmd contracts:fuzz
pnpm.cmd contracts:verify-release
pnpm.cmd contracts:testnet:proof
pnpm.cmd contracts:deploy:testnet
pnpm.cmd contracts:smoke:testnet
pnpm.cmd --filter @repo/stellar format:check
pnpm.cmd --filter @repo/stellar lint
pnpm.cmd --filter @repo/stellar typecheck
pnpm.cmd --filter @repo/stellar test
```

Local-SAC happy and negative proof, binding generation/drift, resource
profiling, fuzz-target orchestration, artifact verification, deployment, and
testnet-smoke orchestration are implemented and fail closed by default. The
native suite covers deterministic generated lifecycle sequences and
TTL/archive restoration. Public-testnet deployment and lifecycle proof pass.
Linux execution of both `cargo-fuzz` targets passed 10,000 runs per target.
Mutation analysis remains a P1 follow-up.

## Evidence record

Each evidence artifact must state:

- evidence name and scenario;
- source commit and candidate artifact digest;
- environment/network and non-secret tool versions;
- exact command or reproducible procedure;
- start/end time where relevant;
- actual result and measurements;
- defect/regression links;
- reviewer, review date, and decision.

### Redaction rules

Never retain:

- secret seeds or private keys;
- JWTs, cookies, RPC credentials, or secret headers;
- raw signed transactions;
- PII;
- legal or commercial text, line items, invoices, shipment text, reasons, files,
  or raw commercial JSON.

Public testnet addresses, contract IDs, transaction hashes, and ledgers are
expected. Inspect logs and raw XDR before publication.

## Current status and defects

| Gate                     | Status                  | Notes                                                                                                                                                                                           |
| ------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ABI/control review       | Pending                 | Required discipline approvals not recorded                                                                                                                                                      |
| Unit and matrix tests    | Engineering verified    | 20 native real-SAC lifecycle, invariant, authorization, boundary, generated-sequence, TTL/archive, and multi-asset tests pass                                                                   |
| Exact authorization      | Working-tree verified   | Funding nested SAC tree and the required snapshotted actor for every mutator are asserted                                                                                                       |
| Properties/fuzz          | Engineering verified    | Deterministic 1,024-action lifecycle property pass plus 10,000 Linux executions for each `cargo-fuzz` funding and lifecycle target; no crash                                                    |
| TTL/archive              | Working-tree verified   | Instance/code/data extension and archive restoration preserve deadline and terminal rules                                                                                                       |
| Resource budgets         | Working-tree verified   | Live limits captured; all 13 callable entry points passed approved ceilings on exact optimized local WASM                                                                                       |
| Local real-SAC proof     | Working-tree verified   | Exact optimized artifact passes both-asset release/refund/cancel, unsupported/insufficient/trustline failures, payout rollback, races, replay denial, and multi-escrow liability reconciliation |
| Optimized WASM           | Engineering verified    | Optimized 19,617-byte artifact and 14-function spec verified against contract source commit `a9d09f9bf489`                                                                                      |
| Bindings/decoders        | Engineering verified    | Bindings regenerate to the manifest digest; generated adapter and all error/event decoder variants pass package tests                                                                           |
| Testnet deployment/smoke | Engineering verified    | Preferred contract `CCEECHOG…ZAP5` deployed at ledger 3,841,429; expanded refund paths, release/cancellation, zero liability, all event XDR, and fetched-WASM match verified                    |
| Known defects            | No Sprint 3 defect open | Repository-wide format check still finds inherited generated Convex declarations outside Sprint 3; recorded in the quality evidence                                                             |

## Sign-off

| Discipline        | Owner                 | Status  | Scope                                        |
| ----------------- | --------------------- | ------- | -------------------------------------------- |
| Contract/Security | Elliot / reviewer TBD | Pending | auth, invariants, atomicity, threat controls |
| QA                | TBD                   | Pending | matrices, properties, fuzz, snapshots        |
| Stellar           | Elliot / TBD          | Pending | SAC, bindings, local/testnet proof           |
| DevOps            | TBD                   | Pending | build, CI, manifest, deployment, secrets     |

Sprint 3 cannot close with any unexplained authorization, payout, liability,
terminal, rollback, ABI, optimized-artifact, binding, manifest, TTL, real-SAC,
or testnet-proof gap.
