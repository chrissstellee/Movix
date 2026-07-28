# Movix Escrow Contract v1 Deployment Runbook

| Metadata                    | Value                                                                       |
| --------------------------- | --------------------------------------------------------------------------- |
| Status                      | Local and public-testnet procedure verified; clean release approval pending |
| Sprint items                | S3-03, S3-12 through S3-14                                                  |
| Contract/schema version     | `1` / `1`                                                                   |
| Target                      | Stellar testnet only                                                        |
| Requirements authority      | `docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md`                        |
| Source commit               | Pending release capture                                                     |
| Last documentation review   | 2026-07-28                                                                  |
| Last procedure verification | 2026-07-28 working tree                                                     |
| Required reviewers          | Contract/Security, Stellar, QA, DevOps, Product                             |
| Approval                    | Pending                                                                     |
| Evidence index              | `docs/evidence/sprint-03/README.md`                                         |

This runbook defines the release procedure; it does not record a completed
release. Commands that depend on scripts, identities, assets, network state, or
release artifacts remain Planned until their existence and output are verified.

## Safety rules

- Testnet only. Stop if the resolved network is mainnet or its passphrase does
  not match the reviewed testnet configuration.
- Never place a seed, private key, JWT, cookie, RPC credential, secret header,
  or raw signed transaction in a command, script argument, log, manifest, or
  evidence file.
- Use approved CLI identities or CI secret injection. Do not commit deterministic
  local fixture secrets.
- Independently verify the XLM SAC and approved USDC issuer/SAC against an
  authoritative source at execution time.
- Treat public addresses, contract IDs, transaction hashes, and ledger numbers
  as publishable testnet evidence only after confirming the network.
- Deployment is a controlled external state change. Use a dry-run or help mode
  first, and require explicit release-environment enablement for testnet writes.
- Never work around uncertainty with mutable configuration, manual ledger
  correction, an admin transfer, or a rescue backdoor.

## Required roles

| Discipline        | Responsibility                                                         | Owner/status                     |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------- |
| Product           | Confirm testnet-only scope, pilot fee policy, and known limitations    | Nicole / Chris; approval Pending |
| Architecture      | Review ABI, storage, trust boundaries, TTL, and liveness limitation    | Owner Pending                    |
| Contract/Security | Review authorization, invariants, atomicity, errors, and events        | Elliot / reviewer Pending        |
| Stellar           | Verify SACs, protocol compatibility, bindings, and testnet proof       | Elliot / reviewer Pending        |
| QA                | Approve matrices, snapshots, local proof, and regression evidence      | Owner Pending                    |
| DevOps            | Approve optimized build, CI, manifest, secrets, and deployment process | Owner Pending                    |

No release closes without named owners and recorded approvals.

## Prerequisites

- [ ] The Day 1 ABI, state machine, errors, events, threat model, prohibited API,
      resource ceilings, and mainnet blockers are approved.
- [ ] Baseline and final Rust, Cargo, `soroban-sdk`, Stellar CLI, Stellar XDR,
      Node, package manager, protocol, RPC, and network-limit versions are captured.
- [ ] The Stellar CLI can perform an optimized locked build without an
      optimization-skipped or missing-`additional-libs` warning.
- [ ] The configured protocol and RPC are compatible with the selected SDK/CLI.
- [ ] The local network runner is available and can apply testnet-like limits.
- [ ] Buyer, supplier, wrong-party, treasury, XLM-like, USDC-like, and unsupported
      SAC fixtures are available without committed secrets.
- [ ] Testnet identities are funded through approved secret handling.
- [ ] Approved testnet XLM and USDC issuer/SAC addresses are independently
      re-verified and recorded.
- [ ] The treasury is a reviewed public address and not the deployed contract.
- [ ] Pilot deployment uses the reviewed fee cap and zero-fee call policy.
- [ ] TTL values are within recorded live testnet limits.
- [ ] P0 tests, properties, fuzz targets, snapshots, resource budgets, and local
      real-SAC proof are green.

## 1. Establish a clean release context

1. Confirm the working tree and identify the exact source commit to release.
2. Review all uncommitted changes; do not incorporate unrelated changes.
3. Capture tool versions without credentials.
4. Confirm the release network configuration is testnet.
5. Create an evidence sequence for this attempt using the convention in the
   evidence index.

Recommended read-only commands:

```powershell
git status --short
git rev-parse HEAD
rustc --version
cargo --version
stellar --version
node --version
pnpm.cmd --version
```

Record actual output in evidence; do not copy the baseline versions from the
requirements document as final versions.

## 2. Run quality gates

```powershell
cargo fmt --manifest-path contracts/Cargo.toml --all -- --check
cargo clippy --manifest-path contracts/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path contracts/Cargo.toml --lib
pnpm.cmd --filter @repo/stellar format:check
pnpm.cmd --filter @repo/stellar lint
pnpm.cmd --filter @repo/stellar typecheck
pnpm.cmd --filter @repo/stellar test
```

The repository provides fail-closed build, binding, local-network,
local-smoke, negative-SAC, resource-profile, fuzz, testnet-proof,
testnet-deployment, testnet-smoke, and artifact-verification commands:

```powershell
pnpm.cmd build:contracts
pnpm.cmd contracts:bindings
pnpm.cmd contracts:local:setup -- --execute --reset
pnpm.cmd contracts:local:smoke -- --execute
pnpm.cmd contracts:local:negative -- --execute
pnpm.cmd contracts:resources -- --execute
pnpm.cmd contracts:fuzz
pnpm.cmd contracts:verify-release
pnpm.cmd contracts:testnet:proof
pnpm.cmd contracts:deploy:testnet
pnpm.cmd contracts:smoke:testnet
```

Deployment and network-writing smoke commands are dry-run/disabled unless
their explicit execution flag and required environment configuration are
present. Generated-sequence, TTL/archive, negative-SAC, and measured resource
gates are implemented and pass on the working tree. Public-testnet deployment
and lifecycle proof pass. Linux fuzz execution, mutation analysis, and
commit-bound release evidence remain pending.

Stop on any P0 failure. A test rerun does not replace investigation of a
financial invariant, authorization, or artifact-identity failure.

## 3. Build the optimized release artifact

```powershell
stellar contract build `
  --manifest-path contracts/Cargo.toml `
  --locked `
  --optimize
```

Confirm that:

- optimization was performed and no warning says it was skipped;
- the expected release WASM exists;
- the exported specification contains exactly the public interface in
  `abi.md`;
- no prohibited entry point exists;
- WASM size and SHA-256 are captured from this exact file.

The expected artifact path from the Sprint 3 specification is:

```text
contracts/target/wasm32v1-none/release/movix_escrow.wasm
```

Do not reuse the pre-Sprint-3 baseline hash; it is not a release hash.

## 4. Generate and verify TypeScript bindings

Generate bindings only from the exact optimized WASM:

```powershell
stellar contract bindings typescript `
  --wasm contracts/target/wasm32v1-none/release/movix_escrow.wasm `
  --output-dir packages/stellar/generated/escrow `
  --overwrite
```

Then run TypeScript formatting, lint, type checking, tests, event/error decoder
coverage, and the binding-drift check. Capture a binding digest according to
the release verifier's deterministic algorithm. Generated files must not be
edited manually.

If the ABI changes, stop. Reopen contract review, produce a new optimized WASM,
regenerate bindings, update the manifest, and make an explicit version decision.

## 5. Prove the candidate locally

Start from a clean local Stellar network with testnet-like limits. The
implemented cross-platform orchestration paths are:

```text
scripts/contracts/local-setup.mjs
scripts/contracts/local-smoke.mjs
scripts/contracts/local-negative.mjs
scripts/contracts/resource-profile.mjs
scripts/contracts/verify-release.mjs
```

They display safe help or dry-run behavior, fail closed, and redact secrets.
Create/reset the explicitly named local fixture and run its smoke proof with:

```powershell
pnpm.cmd contracts:local:setup -- --execute --reset
pnpm.cmd contracts:local:smoke -- --execute
pnpm.cmd contracts:local:negative -- --execute
pnpm.cmd contracts:resources -- --execute
```

The local proof must deploy the same optimized WASM and cover:

- XLM-like and USDC-like fund, accept, ship, and release;
- mutual refund initiated by each party and from every active state;
- expired-unaccepted cancellation;
- unsupported SAC and insufficient balance;
- authorization/trustline failure where applicable;
- failed supplier or treasury payout with complete rollback;
- duplicate funding and serialized release/refund/cancel races;
- multiple escrows/assets with contract balances reconciled to liabilities.

After every step, compare getters, decoded events, token balances, and
liability. Capture the candidate WASM digest in the transcript.

## 6. Prepare the deployment manifest

Create or update:

```text
deployments/stellar/testnet/escrow-v1.json
```

The manifest must contain:

- manifest schema, contract, and escrow schema versions;
- testnet name and passphrase name or fingerprint;
- RPC environment label without credentials;
- exact source commit;
- Rust, `soroban-sdk`, Stellar CLI, and protocol versions;
- optimized WASM path, size, and SHA-256;
- contract ID and deployment transaction hash/ledger after deployment;
- immutable constructor configuration;
- treasury public address;
- verified XLM and USDC issuer/SAC addresses;
- fee cap and zero-fee pilot policy;
- TTL values and captured network-limit reference;
- binding command/version and deterministic binding digest;
- evidence index path, deployment timestamp, and testnet-only warning.

The manifest must not contain any secret, credential, cookie, raw signed
transaction, or private identity material.

Before deployment, populate only fields known from reviewed inputs and the exact
artifact. Do not invent future contract IDs, hashes, ledgers, or timestamps.

## 7. Deploy to testnet

### Verified Sprint 3 deployment

On 2026-07-28, the exact optimized working-tree artifact was deployed to
Stellar testnet:

- Contract:
  [`CAAU4AY6UBXVYGCWWXQ5KOAYEFWG7IPTNSACBLEMII3XX4HYD4C6KMIS`](https://stellar.expert/explorer/testnet/contract/CAAU4AY6UBXVYGCWWXQ5KOAYEFWG7IPTNSACBLEMII3XX4HYD4C6KMIS)
- Deployment transaction:
  [`83290e28…ff907`](https://stellar.expert/explorer/testnet/tx/83290e28fba0d7a25891000625fb3a3a357910123a3339ce849ee88b9f9ff907)
- Deployment ledger: `3,839,808`
- Manifest: `deployments/stellar/testnet/escrow-v1.json`
- Evidence:
  `docs/evidence/sprint-03/S3-TESTNET-LIFECYCLES-008bec114c4e-TESTNET-001.json`

Read-only post-deployment verification returned contract version `1`, the
expected immutable configuration, zero XLM liability after smoke, and a fetched
WASM whose 19,617-byte size and SHA-256 exactly matched the release candidate.
This is working-tree evidence tied to base commit `008bec114c4e`; it is not a
clean-commit production release.

The implemented fail-closed script is:

```text
scripts/contracts/deploy-testnet.mjs
```

Dry-run its validation without signing:

```powershell
pnpm.cmd contracts:deploy:testnet
```

Execution additionally requires the script's documented environment gate and
approved identity/configuration values. It:

- require explicit testnet enablement;
- validate network and approved assets before signing;
- accept identities through approved secret mechanisms;
- display the constructor configuration for review;
- deploy the exact verified WASM once;
- avoid printing secrets or raw signed transactions;
- capture the public contract ID, transaction hash, and ledger;
- fail closed on any artifact, network, or configuration mismatch.

Stop if the deployed WASM cannot be proven identical to the local candidate.

## 8. Run the testnet smoke

The 2026-07-28 smoke completed release, mutual refund, and timeout cancellation.
The terminal proof transactions are:

| Scenario             | Status      |    Ledger | Stellar Expert                                                                                                             |
| -------------------- | ----------- | --------: | -------------------------------------------------------------------------------------------------------------------------- |
| Delivery release     | `Released`  | 3,839,817 | [Transaction](https://stellar.expert/explorer/testnet/tx/9c6c5299cc42362d1548d53b7d79944d11b63c3cdfd554faa428e30bdd9ec7b1) |
| Mutual refund        | `Refunded`  | 3,839,823 | [Transaction](https://stellar.expert/explorer/testnet/tx/53466c997350e16794e888ed0c0118bcc25732f05f192a139eee44363c49841e) |
| Timeout cancellation | `Cancelled` | 3,839,830 | [Transaction](https://stellar.expert/explorer/testnet/tx/0ef1d81a49c69789f12a24532c91541e56d93d87f68291f72425bd809e6acff2) |

The implemented fail-closed lifecycle harness is:

```text
scripts/contracts/testnet-smoke.mjs
```

With explicit enablement, identities, contract ID, and approved token
configuration, it executes release, mutual refund, timeout cancellation,
terminal replay denial, terminal getters, and zero-liability checks. Complete
the remaining release evidence around that harness:

1. Confirm version and configuration getters.
2. Complete one release lifecycle.
3. Complete one mutual refund.
4. Complete one timeout cancellation.
5. Execute one unauthorized or invalid call.
6. Confirm terminal replay denial.
7. Verify getters, raw/decoded events, participant and contract balances,
   per-token liability, transaction hashes, and ledgers.
8. Verify generated bindings against the deployed interface.

Testnet smoke does not replace local failure, rollback, race, property, or fuzz
testing.

## 9. Verify and publish evidence

Run the release verifier after the manifest is complete. It must compare:

```text
source commit
  -> optimized WASM path/size/SHA-256
  -> exported specification
  -> generated binding digest
  -> manifest
  -> deployed contract identity
  -> local and testnet evidence
```

Review evidence for secrets, credentials, PII, commercial text, and raw signed
transactions before publication. Link each immutable artifact from
`docs/evidence/sprint-03/README.md`. Record approvals without editing historical
evidence in place.

## Reset, recovery, and redeployment

### Local reset

Reset only the explicitly identified local fixture environment:

```powershell
pnpm.cmd contracts:local:setup -- --execute --reset
```

This recreates fixture identities and assets through the local setup process.
Rerun the entire local proof after reset. Never reuse a local result after the
network state has been replaced.

### Testnet reset or unavailable deployment

1. Confirm the issue is testnet state/reset or archival, not a local
   configuration or RPC error.
2. Preserve the prior manifest and evidence as historical records.
3. Build and verify from the intended source commit again.
4. Re-verify current protocol limits and SAC addresses.
5. Deploy the exact newly verified artifact.
6. Create a new manifest/evidence sequence; never overwrite identifiers from the
   previous deployment.
7. Rerun the full testnet smoke and approvals.

### Archived state or code

The exact restore commands depend on the verified CLI/RPC and are Pending.
Before restoration:

- identify the contract and ledger entries explicitly;
- preserve current public state evidence;
- confirm the operation targets testnet;
- ensure no secret appears in commands or logs.

After restoration, confirm configuration, escrow, liability, balances, and
terminal replay denial through getters and smoke tests. Restoration must not
change lifecycle state or create authority.

### Failed deployment or smoke

Do not mutate configuration or manually correct contract state. Record the
failure, redact evidence, determine whether a new artifact is required, and
restart at the earliest invalidated gate. Any ABI/source change requires a new
WASM, bindings, manifest, deployment, and review.

## Closure criteria

Deployment is not complete until:

- all P0 gates are green;
- optimization is proven, not skipped;
- local and testnet proofs use one exact artifact;
- WASM, bindings, manifest, and deployment identities agree;
- liabilities and balances reconcile;
- no P0 defect or unexplained invariant remains;
- another engineer can follow this runbook;
- Product, Contract/Security, QA, Stellar, and DevOps approvals are linked.
