# Sprint 6 pilot-corridor decision register

This register makes every pilot assumption explicit and assigns an accountable owner role. These are release inputs, not claims that external legal, logistics, or compliance integrations exist.

| Decision area | Interim Sprint 6 assumption | Accountable owner | Required closure evidence | Gate |
|---|---|---|---|---|
| Pilot corridor | Philippines importer ↔ verified ASEAN exporter on Stellar Testnet | Product owner | Named pilot organizations and approved corridor memo | Pilot activation |
| Commodity and UOM | Controlled agricultural categories; exact decimal quantity; `KG`, `MT`, `T`, `LB`, `L`, `M3`, `BAG`, `BOX`, or `EA` only | Product owner | Pilot commodity/UOM catalogue with version and effective date | New Trade Order release |
| Required documents | Importer commits the required document-type list per v2 revision; no authenticity claim is inferred | Trade operations owner | Corridor checklist mapped to canonical document type codes | Pilot activation |
| Incoterm | Incoterms 2020 rule and named place are mandatory when an Incoterm is selected | Legal owner | Counsel-approved supported-rule list and named-place guidance | Pilot activation |
| Settlement asset | Testnet XLM and configured Testnet USDC remain the only UI choices; no Mainnet readiness claim | Treasury owner | Asset issuer/contract allowlist and treasury sign-off | Escrow activation |
| Organization verification | Consequential actions require an operator-reviewed `verified` organization case, separate from wallet proof | Compliance owner | Evidence policy, reviewer roster, recovery SLA, and sample audit export | Release |
| Invitation policy | One intended Exporter, single-use token, seven-day default expiry, revocable, no marketplace discovery | Product owner | Abuse review and support recovery procedure | Release |
| Dispute and refund | Sprint 6 does not add a dispute engine; escrow v1 refund/cancellation rules remain authoritative | Legal owner | Deadlock and escalation policy approved against escrow v1 | Escrow activation |
| Document scanning | Uploads remain non-downloadable until the configured scanner records `clean`; `pending` and `rejected` fail closed | Security owner | Scanner integration proof, signature/version record, malicious fixture result | Release |
| Document retention | Versions are immutable in the application model; deletion/retention automation is not enabled until policy approval | Privacy owner | Retention schedule, legal-hold behavior, deletion runbook | Production data |
| Evidence manifests | Shipment/delivery evidence binds exact clean document digests, order/revision, network, contract, and escrow identifiers | Engineering owner | Golden manifest, recomputation proof, and Testnet projection reconciliation | Release |
| Migration | Additive widen/backfill only; no fabricated v2 facts; `legacy_incomplete` drafts require user completion | Data owner | Dry-run/applied/second-run counts and orphan report equal zero | Deployment |

## Change control

- The accountable owner records the approver, decision date, evidence link, and effective version when closing a gate.
- A changed commodity, route, Incoterm, document requirement, counterparty, quantity/UOM, price/asset, or date is a material amendment and requires a new revision plus Exporter re-acceptance.
- An unresolved row remains a blocking gate for the gate named in the final column; it must not be silently waived or represented as passed.
