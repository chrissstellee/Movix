# Sprint 3 Escrow Contract v1 Evidence Index

| Metadata                   | Value                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| Status                     | Engineering closure verified; independent discipline approvals pending |
| Sprint                     | 3 of 10                                                                |
| Contract/schema version    | Target `1` / `1`                                                       |
| Requirements authority     | `docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md`                   |
| Contract source commit     | `a9d09f9bf4890d6093803be6d1a62fe5d460a2b2`                             |
| Last index review          | 2026-07-28                                                             |
| Last evidence verification | 2026-07-28                                                             |
| Closure decision           | Engineering complete; organizational sign-off remains open             |
| Required final approvers   | Product, Contract/Security, QA, Stellar, DevOps                        |

Live testnet protocol/resource settings and deterministic XLM/USDC SAC IDs were
re-verified on 2026-07-28. All 13 callable entry points were measured on the
exact optimized WASM under local testnet limits and passed the approved
ceilings. Review approval remains Pending.
The same optimized WASM was deployed to public Stellar testnet as
[`CCEE…ZAP5`](https://stellar.expert/explorer/testnet/contract/CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5).
Release, refund rejection/restoration, refund withdrawal/restoration, mutual
refund, and timeout cancellation completed successfully. The final XLM
liability was zero, all ten event types were captured with raw XDR, and the
contract WASM fetched from testnet matched the candidate digest exactly.
The Rust, SDK, CLI/XDR, Node, package-manager, protocol, and RPC
versions, optimized artifact identity, and binding digest are recorded in
`docs/contracts/escrow-v1/toolchain.json`.

This directory is the evidence index for Sprint 3 proof. Each linked JSON
record identifies the source commit and environment it actually verified.
Earlier working-tree evidence remains historical; the closure artifacts use
the contract source commit above. Independent discipline approval remains
required for organizational closure.

## Verified evidence

| Evidence                                                                                                             | Result                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`S3-TESTNET-LIFECYCLES-a9d09f9bf489-TESTNET-002.json`](./S3-TESTNET-LIFECYCLES-a9d09f9bf489-TESTNET-002.json)       | Preferred public deployment; expanded release/refund/cancellation proof, zero liability, and fetched-WASM match           |
| [`S3-EVENT-TESTNET-CATALOG-a9d09f9bf489-TESTNET-001.json`](./S3-EVENT-TESTNET-CATALOG-a9d09f9bf489-TESTNET-001.json) | Raw topic/value XDR for all ten configured lifecycle event types                                                          |
| [`S3-TESTNET-SUPERSESSION-a9d09f9bf489-TESTNET-001.json`](./S3-TESTNET-SUPERSESSION-a9d09f9bf489-TESTNET-001.json)   | Superseded test deployment incident and corrective actions                                                                |
| [`S3-FUZZ-LINUX-a9d09f9bf489-NATIVE-001.json`](./S3-FUZZ-LINUX-a9d09f9bf489-NATIVE-001.json)                         | Funding and lifecycle targets each passed 10,000 Linux executions without a crash                                         |
| [`S3-TESTNET-LIFECYCLES-008bec114c4e-TESTNET-001.json`](./S3-TESTNET-LIFECYCLES-008bec114c4e-TESTNET-001.json)       | Public deployment plus release/refund/cancellation proof passed; fetched WASM matches and final liability is zero         |
| [`S3-QUALITY-WORKTREE-008bec114c4e-NATIVE-001.json`](./S3-QUALITY-WORKTREE-008bec114c4e-NATIVE-001.json)             | Contract/package/repository gates pass; inherited Convex-generated formatting issue recorded separately                   |
| [`S3-TEST-LOCAL-CLOSURE-008bec114c4e-NATIVE-001.json`](./S3-TEST-LOCAL-CLOSURE-008bec114c4e-NATIVE-001.json)         | 20 Rust tests pass, including exact mutator auth, TTL/archive restoration, 1,024 generated actions, and multi-asset races |
| [`S3-LOCAL-REAL-SAC-008bec114c4e-LOCAL-001.json`](./S3-LOCAL-REAL-SAC-008bec114c4e-LOCAL-001.json)                   | Exact optimized WASM passes two-asset lifecycles, rollback failures, races, and liability reconciliation                  |
| [`S3-RESOURCE-ENTRYPOINTS-008bec114c4e-LOCAL-001.json`](./S3-RESOURCE-ENTRYPOINTS-008bec114c4e-LOCAL-001.json)       | All measured entry points remain below approved resource ceilings                                                         |
| [`S3-NETWORK-ASSETS-008bec114c4e-TESTNET-001.json`](./S3-NETWORK-ASSETS-008bec114c4e-TESTNET-001.json)               | Testnet protocol, limits, XLM SAC, USDC issuer, and USDC SAC re-verified read-only                                        |

## Documentation set

| Document                                           | Purpose                                                                       | Status                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/contracts/escrow-v1/abi.md`                  | Types, public ABI, transitions, storage, invariants, integration policy       | Working-tree implementation verified; approval pending                 |
| `docs/contracts/escrow-v1/threat-model.md`         | Trust boundaries, threats, controls, residual risks                           | Local controls verified; external evidence/review pending              |
| `docs/contracts/escrow-v1/errors-and-events.md`    | Stable codes, event payloads, decoder and snapshot policy                     | Native decoders and complete raw testnet XDR catalog verified          |
| `docs/contracts/escrow-v1/deployment-runbook.md`   | Build, local proof, manifest, deployment, smoke, recovery                     | Local and public-testnet procedures engineering-verified               |
| `docs/contracts/escrow-v1/testing-and-evidence.md` | Fixtures, matrices, properties, fuzz, SAC, resource and evidence requirements | Native, Linux fuzz, local SAC, resource, and testnet evidence recorded |

## Evidence naming

Use:

```text
S3-<GROUP>-<SCENARIO>-<commit12>-<environment>-<sequence>
```

Rules:

- `GROUP` identifies the proof area, such as `BASELINE`, `ABI`, `THREAT`,
  `TEST`, `AUTH`, `FUZZ`, `EVENT`, `STATE`, `ROLLBACK`, `TTL`, `RESOURCE`,
  `WASM`, `BINDING`, `LOCAL`, `TESTNET`, `MANIFEST`, `LIMITATION`, or
  `SIGNOFF`.
- `SCENARIO` is a short uppercase/hyphenated description.
- `commit12` is the actual first 12 characters of the tested source commit.
- `environment` identifies a non-secret environment such as `NATIVE`,
  `LOCAL`, `CI`, or `TESTNET`.
- `sequence` is a stable, zero-padded sequence for repeated attempts.
- Never use a fabricated hash or placeholder that could be confused with a real
  commit.
- Failed attempts are evidence. Preserve them with their own sequence and link
  the defect or resolution.

Every artifact records its source commit, exact command or procedure, tool
versions, environment, actual result, timestamps where relevant, and reviewer
decision.

## Redaction and publication rules

Before adding evidence, remove and verify the absence of:

- secret seeds and private keys;
- JWTs, cookies, RPC credentials, secret headers, and CI secret values;
- raw signed transactions;
- PII;
- legal/commercial text, line items, addresses, invoices, shipment text,
  refund reasons, files, and raw commercial JSON.

Public testnet addresses, contract IDs, transaction hashes, and ledger numbers
are expected evidence after the network is confirmed. Review raw event XDR and
storage snapshots before publication. Do not include screenshots or logs merely
because they exist; retain the smallest artifact that proves the gate.

Evidence should be append-only after review. Corrections create a new artifact
and link the superseded record; they do not silently rewrite history.

## Sprint traceability

| Sprint item | Required proof                                                                                             | Status                                 | Evidence                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| S3-01       | Approved ABI/state machine, threat model, error/event catalog, prohibited API, resource ceilings, blockers | Pending                                | —                                                                                             |
| S3-02       | Complete types/storage, schema fields, persistent escrow/liability keys                                    | Engineering verified; approval pending | Native and ABI evidence                                                                       |
| S3-03       | Constructor validation, immutable config, TTL, approved asset configuration                                | Engineering verified; approval pending | Native, TTL, and network evidence                                                             |
| S3-04       | Atomic funding, buyer/nested SAC auth, fee arithmetic, liability increase, rollback                        | Engineering verified; approval pending | Native and local SAC evidence                                                                 |
| S3-05       | Bounded getters, typed missing/unsupported behavior, TTL                                                   | Engineering verified; approval pending | Native and resource evidence                                                                  |
| S3-06       | Supplier acceptance/shipment, terms/deadline/hash/auth/event behavior                                      | Engineering verified; approval pending | Native/auth evidence                                                                          |
| S3-07       | Buyer release, exact net/fee payout, conservation, rollback, replay denial                                 | Engineering verified; approval pending | Native and local rollback evidence                                                            |
| S3-08       | Both-party refund proposal/response, restoration, full refund, races                                       | Engineering verified; approval pending | Generated-sequence and local race evidence                                                    |
| S3-09       | Exact cancellation boundary, full refund, liability and replay behavior                                    | Engineering verified; approval pending | Native, archive, and local SAC evidence                                                       |
| S3-10       | Errors 1–20, ten typed events, raw/decoded snapshots, failure guarantees                                   | Engineering verified; approval pending | Decoder/tests pass; all ten raw testnet event XDR variants captured                           |
| S3-11       | TTL, per-token liability, terminal and archive/restore invariants                                          | Engineering verified; approval pending | TTL/archive and multi-asset evidence                                                          |
| S3-12       | Unit/auth/boundary/property/fuzz/snapshot/resource/security suite                                          | Engineering verified; approval pending | Unit/auth/generated properties/resources pass; both Linux fuzz targets pass 10,000 executions |
| S3-13       | Clean local real-WASM/real-SAC happy, failure, race, rollback proof                                        | Engineering verified; approval pending | Local real-SAC evidence                                                                       |
| S3-14       | Optimized WASM, generated bindings, decoders, manifest, testnet smoke, verifier                            | Engineering verified; approval pending | Preferred deployment, manifest, lifecycle proof, raw XDR, and fetched-WASM match recorded     |
| S3-15       | Static and mutation analysis after P0 gates                                                                | Planned P1                             | —                                                                                             |

## Required evidence register

| Evidence                   | Minimum contents                                                                                  | Owner                            | Status                | Link                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Baseline versions          | Rust, Cargo, SDK, CLI, XDR, Node/package manager, protocol/RPC; baseline commands/results         | DevOps/Stellar                   | Pending               | —                                                                                      |
| Final versions             | Same version set for exact release                                                                | DevOps/Stellar                   | Pending               | —                                                                                      |
| ABI approval               | Contract/schema version, exported functions/spec, prohibited-function check, discipline decisions | Architecture/Contract/QA/Product | Pending               | —                                                                                      |
| Threat-model review        | Threat/control disposition, residual risks, reviewer decision                                     | Contract/Security                | Pending               | —                                                                                      |
| Rust test summary          | Command, cases, pass/fail, source commit                                                          | Contract/QA                      | Working-tree verified | `S3-TEST-LOCAL-CLOSURE-008bec114c4e-NATIVE-001.json`                                   |
| Authorization snapshots    | Exact trees for all mutators and nested transfers                                                 | Contract/Security                | Working-tree verified | Rust snapshots and native evidence                                                     |
| Boundary/transition matrix | Every function/state, amounts, fees, parties, assets, deadline, hash, repetition                  | QA                               | Pending               | —                                                                                      |
| Property/fuzz summary      | Tools, versions, targets, seeds/corpus, iterations/duration, results, regressions                 | QA/Contract                      | Engineering verified  | `S3-FUZZ-LINUX-a9d09f9bf489-NATIVE-001.json`; deterministic 1,024-action property pass |
| Error coverage             | Codes 1–20 through typed clients; native failures distinct                                        | Contract/Stellar/QA              | Pending               | —                                                                                      |
| Event snapshots            | Raw XDR, generated decode, normalized event for each success path                                 | Stellar/QA                       | Engineering verified  | `S3-EVENT-TESTNET-CATALOG-a9d09f9bf489-TESTNET-001.json`                               |
| Ledger/state snapshots     | Getters, storage where appropriate, transactions/ledgers                                          | QA/Stellar                       | Pending               | —                                                                                      |
| Local setup transcript     | Clean-network creation, fixtures, limits, exact WASM identity                                     | DevOps/Stellar                   | Working-tree verified | Local real-SAC evidence                                                                |
| Local SAC smoke            | XLM-like and USDC-like release/refund/cancel/failure/race flows                                   | Stellar/QA                       | Working-tree verified | `S3-LOCAL-REAL-SAC-008bec114c4e-LOCAL-001.json`                                        |
| Balance/liability proof    | Before/after actors, contract, per-token liabilities, multi-escrow reconciliation                 | Contract/QA                      | Working-tree verified | Native and local real-SAC evidence                                                     |
| Rollback proof             | Failed funding and terminal SAC calls leave no partial effects/events                             | Contract/QA                      | Working-tree verified | Local real-SAC evidence                                                                |
| TTL/archive proof          | Instance/code/escrow/liability extension and restore/replay behavior                              | Contract/DevOps                  | Working-tree verified | Native closure evidence                                                                |
| Resource profile           | Live limits, entry-point measurements, ceilings, regression comparison                            | Contract/Architecture            | Working-tree verified | `S3-RESOURCE-ENTRYPOINTS-008bec114c4e-LOCAL-001.json`                                  |
| Optimized WASM             | Exact path, size, SHA-256, optimization log, exported spec                                        | DevOps/Contract                  | Engineering verified  | `toolchain.json`; contract-source build repeated                                       |
| Binding proof              | Generation command/version, deterministic digest, compile/tests, drift result                     | Stellar                          | Engineering verified  | `toolchain.json`; regeneration produced the manifest digest                            |
| Manifest                   | Complete redacted testnet manifest and verifier result                                            | DevOps/Stellar                   | Working-tree verified | `deployments/stellar/testnet/escrow-v1.json`; clean-commit verifier pending            |
| Testnet deployment         | Contract ID, deployment transaction/ledger, constructor config, WASM match                        | Stellar/DevOps                   | Engineering verified  | `S3-TESTNET-LIFECYCLES-a9d09f9bf489-TESTNET-002.json`                                  |
| Testnet lifecycle smoke    | Release, refund, cancel, events/getters/balances/liability                                        | Stellar/QA                       | Engineering verified  | `S3-TESTNET-LIFECYCLES-a9d09f9bf489-TESTNET-002.json`                                  |
| Known limitations          | Current limitations, mainnet blockers, operational ownership                                      | Product/Architecture             | Pending               | —                                                                                      |
| Final sign-offs            | Product, Contract/Security, QA, Stellar, DevOps decisions and dates                               | Product                          | Pending               | —                                                                                      |

## Command register

These commands reproduce the working-tree quality gates:

```powershell
cargo fmt --manifest-path contracts/Cargo.toml --all -- --check
cargo clippy --manifest-path contracts/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path contracts/Cargo.toml --lib
stellar contract build --manifest-path contracts/Cargo.toml --locked --optimize
pnpm.cmd contracts:bindings
pnpm.cmd contracts:local:setup -- --execute --reset
pnpm.cmd contracts:local:smoke -- --execute
pnpm.cmd contracts:local:negative -- --execute
pnpm.cmd contracts:resources -- --execute
pnpm.cmd contracts:fuzz
pnpm.cmd contracts:verify-release
pnpm.cmd contracts:testnet:proof
pnpm.cmd --filter @repo/stellar format:check
pnpm.cmd --filter @repo/stellar lint
pnpm.cmd --filter @repo/stellar typecheck
pnpm.cmd --filter @repo/stellar test
```

Secret-safe local-SAC, generated-binding, fuzz-target, resource-profile,
artifact-verification, deployment, and testnet-proof commands are implemented
under `scripts/contracts/` and exposed through root package scripts. Network
writes are disabled by default. Linux fuzz execution and contract-source
artifact verification pass. Mutation analysis remains a P1 follow-up.

## Known blockers

- The installed baseline CLI skipped optimization, but the SHA-256-verified
  official v27 Windows release successfully reproduced the optimized artifact
  tied to contract source commit `a9d09f9bf489`.
- Architecture, Contract/Security, QA, Stellar, and DevOps reviewers are not all
  named.
- Live protocol/RPC compatibility, network limits, TTL bounds, and all
  entry-point measurements are captured in
  `docs/contracts/escrow-v1/resource-budgets.json`; independent reviewer
  approval remains pending.
- Testnet XLM and approved USDC issuer/SAC addresses were reverified before the
  2026-07-28 deployment and must be rechecked before any future deployment.
- A clean local network and public-testnet lifecycle smoke passed on the exact
  optimized artifact.
- Optimized WASM, generated bindings, decoders, manifest, testnet smoke,
  fetched-WASM equality, and all ten raw event XDR variants are verified.
- Two `cargo-fuzz` targets and a Linux CI gate are implemented. Both targets
  passed 10,000 Linux executions with no crash.
- v1 lacks a post-shipment liveness/dispute solution and cannot rescue surplus
  tokens.
- Mainnet is blocked on liveness policy, external security review, legal review,
  and incident ownership.

## Closure rule

Current decision: **Not complete**.

Use **Complete** only when all P0 checks are green, local and testnet proof use
one exact artifact, no P0 defect or unexplained invariant remains, and all
required approvals are linked.

A conditional close is allowed only for explicitly approved P1 static/mutation
work or non-security documentation polish with an owner and date. It is never
allowed for ABI, authorization, token behavior, payout, liability, TTL,
real-SAC, optimized artifact, binding, manifest, or testnet-proof gaps.

| Discipline        | Owner                 | Status  | Evidence |
| ----------------- | --------------------- | ------- | -------- |
| Product           | Nicole / Chris        | Pending | —        |
| Architecture      | TBD                   | Pending | —        |
| Contract/Security | Elliot / reviewer TBD | Pending | —        |
| Stellar           | Elliot / TBD          | Pending | —        |
| QA                | TBD                   | Pending | —        |
| DevOps            | TBD                   | Pending | —        |
