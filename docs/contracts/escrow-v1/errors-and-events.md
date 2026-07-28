# Movix Escrow Contract v1 Errors and Events

| Metadata                         | Value                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| Status                           | As-built catalog; native decoder and raw testnet XDR verified |
| Sprint items                     | S3-01, S3-10, S3-12, S3-14                                    |
| Contract/schema version          | `1` / `1`                                                     |
| Requirements authority           | `docs/Movix-Sprint-03-Smart-Contract-V1-Detailed.md`          |
| Contract source commit           | `a9d09f9bf4890d6093803be6d1a62fe5d460a2b2`                    |
| Last documentation review        | 2026-07-28                                                    |
| Last implementation verification | 2026-07-28                                                    |
| Required reviewers               | Contract/Security, QA, Stellar                                |
| Approval                         | Pending                                                       |
| Evidence index                   | `docs/evidence/sprint-03/README.md`                           |

## Compatibility policy

Error codes `1` through `8` retain their existing meanings. v1 appends codes
`9` through `20`. A published code must never be reused for another meaning.
Event names and payload types are part of the frozen integration ABI.

Rust contract errors, generated TypeScript errors, and normalized application
errors must preserve the same numeric code and semantic name. Native host,
token, RPC, simulation, signing, and submission failures must remain
distinguishable; normalization must not replace the original transaction error.

Any catalog change requires full contract review, a new optimized WASM,
regenerated bindings, a manifest update, and an explicit contract-version
decision.

## Stable contract errors

| Code | Contract name            | Safe normalized category   | Meaning                                                     |
| ---: | ------------------------ | -------------------------- | ----------------------------------------------------------- |
|    1 | `InvalidConfig`          | `invalid_config`           | Constructor or configuration value is structurally invalid  |
|    2 | `UnsupportedAsset`       | `unsupported_asset`        | Token is not in the immutable allowlist                     |
|    3 | `InvalidAmount`          | `invalid_amount`           | Amount is zero or negative                                  |
|    4 | `SameParty`              | `same_party`               | Buyer and supplier are the same address                     |
|    5 | `EscrowExists`           | `escrow_exists`            | Escrow ID already exists                                    |
|    6 | `EscrowNotFound`         | `escrow_not_found`         | Escrow ID does not exist                                    |
|    7 | `InvalidTransition`      | `invalid_transition`       | Current status does not permit the function                 |
|    8 | `ArithmeticFailure`      | `arithmetic_failure`       | Checked calculation failed                                  |
|    9 | `FeeTooHigh`             | `fee_too_high`             | Requested fee exceeds the configured cap                    |
|   10 | `InvalidDeadline`        | `invalid_deadline`         | Creation deadline is not in the future                      |
|   11 | `AcceptanceExpired`      | `acceptance_expired`       | Acceptance was attempted at or after the deadline           |
|   12 | `CancellationTooEarly`   | `cancellation_too_early`   | Cancellation was attempted before the deadline              |
|   13 | `TermsMismatch`          | `terms_mismatch`           | Acceptance terms hash differs from the funded hash          |
|   14 | `UnauthorizedParty`      | `unauthorized_party`       | Actor argument is not the required snapshotted party        |
|   15 | `SamePartyApproval`      | `same_party_approval`      | Refund proposer attempted to approve its own proposal       |
|   16 | `RefundTermsMismatch`    | `refund_terms_mismatch`    | Response hash differs from the pending refund hash          |
|   17 | `RefundProposerMismatch` | `refund_proposer_mismatch` | Withdrawal actor is not the recorded proposer               |
|   18 | `InvariantViolation`     | `invariant_violation`      | Stored state, liability, or payout relation is inconsistent |
|   19 | `InvalidHash`            | `invalid_hash`             | Required commitment hash is all zero                        |
|   20 | `NotInitialized`         | `not_initialized`          | Required instance configuration is absent or unavailable    |

Authorization failure by the correct actor, SAC transfer failure, and host/RPC
failure are not aliases for `UnauthorizedParty` or another contract error. The
adapter should expose a safe category while retaining the original failure for
diagnosis.

## Failure guarantees

All typed errors and external failures must leave the transaction's business
effects unchanged:

- no partial token movement;
- no escrow creation or lifecycle mutation;
- no liability increment or decrement;
- no new lifecycle event.

TTL extension is not business authorization or lifecycle state. Tests should
focus unchanged-state assertions on financial state, escrow state, and
lifecycle events while separately verifying supported TTL behavior.

Every reachable typed error requires a generated `try_` client test. Tests must
also cover host, token, and authorization failures without flattening them into
contract codes.

## Stable lifecycle events

Events are typed, bounded, indexable, and PII-free. Every event includes the
escrow ID and resulting or restored status. Financial events include token and
gross amount. A hash appears only when the transition introduces or confirms
that commitment.

| Event             | Trigger                                 | Required payload                                                                 |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `Configured`      | Constructor                             | treasury, supported-asset count, fee cap, contract version                       |
| `Funded`          | Create and fund                         | ID, buyer, supplier, token, gross, fee, accept-by, terms hash, `Funded`          |
| `Accepted`        | Supplier acceptance                     | ID, supplier, terms hash, `Accepted`                                             |
| `Shipped`         | Supplier shipment commitment            | ID, supplier, shipment hash, `Shipped`                                           |
| `Released`        | Buyer delivery confirmation             | ID, buyer, supplier, treasury, token, gross, fee, net, delivery hash, `Released` |
| `RefundProposed`  | Either party proposes                   | ID, proposer, refund terms hash, resume status, `RefundPending`                  |
| `RefundRejected`  | Counterparty rejects                    | ID, proposer, responder, refund terms hash, restored status                      |
| `RefundWithdrawn` | Proposer withdraws                      | ID, proposer, refund terms hash, restored status                                 |
| `Refunded`        | Counterparty approves                   | ID, proposer, approver, buyer, token, gross, refund terms hash, `Refunded`       |
| `Cancelled`       | Buyer cancels expired unaccepted escrow | ID, buyer, token, gross, accept-by, `Cancelled`                                  |

### Publication rules

- Publish only after every check and effect succeeds.
- A failed call emits no lifecycle event.
- Keep topics within the live protocol limit recorded for the release.
- Do not include names, emails, addresses, legal/commercial text, line items,
  shipment text, reasons, files, or raw commercial JSON.
- A shipment or delivery hash records a party commitment; it does not prove a
  physical event.
- Indexers may use events for discovery, but current material state must be
  confirmed through getters.

## Decoder contract

The generated WASM binding is the source of event and error types. The
`packages/stellar` adapter must:

- decode all 20 stable contract errors;
- expose the stable numeric code and safe normalized category;
- retain the original host/transaction failure;
- normalize all ten event variants without replacing generated types with
  `unknown`;
- reject or surface unsupported event shapes rather than silently dropping
  fields;
- keep signing/submission state separate from confirmed contract state.

The stable error decoder, original-failure preservation, ten-variant normalized
event union, strict event decoder, and unknown-event rejection are implemented
in `packages/stellar/src/contract-errors.ts` and
`packages/stellar/src/events.ts`. Native tests cover all 20 mappings and all
ten event variants. Raw topic and value XDR for every variant is recorded in
`docs/evidence/sprint-03/S3-EVENT-TESTNET-CATALOG-a9d09f9bf489-TESTNET-001.json`.

## Snapshot requirements

For every successful transition, capture:

- raw event XDR;
- decoded generated-binding representation;
- normalized application representation;
- corresponding escrow getter;
- relevant liability getter;
- contract and participant balances;
- exact authorization tree where applicable.

Snapshot changes require review; snapshots must not be blindly regenerated.
Redact secrets and credentials before storage. Raw XDR must be reviewed for
prohibited data.

Suggested evidence names:

```text
S3-EVENT-<SCENARIO>-<commit12>-<environment>-<sequence>
S3-ERROR-<SCENARIO>-<commit12>-<environment>-<sequence>
```

`<commit12>` is captured from the tested source; do not insert a placeholder
that could be mistaken for a real commit.

## Coverage matrix

| Area            | Minimum proof                                                  | Status                                                     |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| Codes 1–20      | Each reachable code through typed `try_` client                | Pending                                                    |
| Native failures | Host/token/auth errors remain distinct                         | Decoder preservation test passes; network evidence Pending |
| Success events  | Raw XDR, decoded value, normalized value                       | Normalized variants tested; all raw testnet XDR captured   |
| Failed calls    | No lifecycle event and no business-state change                | Pending                                                    |
| ABI drift       | Generated binding change fails the drift gate                  | CI gate implemented; optimized-artifact run Pending        |
| Privacy         | Event/storage/XDR review against prohibited data               | Pending                                                    |
| Compatibility   | Numeric/name mappings match Rust, generated, normalized layers | Native mapping tests pass; release digest Pending          |
