# Escrow Reconciliation & Operations Runbook

This operational runbook governs monitoring, incident investigation, and read-only reconciliation procedures for Stellar escrow funding transactions in Movix.

## 1. Automated Status Lifecycle

```text
unfunded
  -> funding_submitted   (wallet submitted tx hash captured)
  -> funded              (Soroban RPC success + get_escrow getter 100% invariant match)
  -> needs_reconciliation (timeout, getter mismatch, or provider ambiguity)
```

## 2. Investigating `needs_reconciliation` Incident Alerts

When an escrow transitions to `needs_reconciliation`, an operations signal is raised. Operational personnel must inspect the record using read-only procedures:

1. **Verify Submitted Transaction Hash**:
   Check hash on Stellar Expert: `https://stellar.expert/explorer/testnet/tx/{hash}`.
   Confirm if transaction succeeded or failed on ledger.

2. **Query Contract `get_escrow`**:
   Execute read-only contract query using `EscrowContractClient.getEscrow({ id: escrowKeyBytes })`.
   Compare returned on-chain fields against database fields:
   - Contract ID vs verified manifest ID
   - Buyer & Supplier wallets
   - Token SAC & gross amount
   - Terms hash bytes vs revision terms hash
   - Status (`Funded` vs `Unfunded`)

3. **Read-Only Repair Mutation**:
   - If `get_escrow` confirms status is `Funded` and all 10 fields match 100%, invoke internal mutation `escrowReconciliation.applyResult` with `status: "funded"`.
   - If on-chain transaction permanently failed and no escrow exists, restore order state to `unfunded` allowing clean retry.
   - **CRITICAL**: Operator repair actions can ONLY sync application projections with verified chain facts. No operator action can move funds on-chain.

## 3. Event Ingestion Cursor Lag

- Event receipts are stored in `contractEventReceipts` keyed by `(network, contractId, transactionHash, eventIndex)`.
- If RPC provider rate limits or drops connections, background ingestion resumes automatically from the stored `reconciliationCursors` ledger pointer without skipping blocks.
