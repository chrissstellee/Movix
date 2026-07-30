# Escrow Funding Architecture & Sequence Diagrams

This document illustrates the end-to-end multi-party interaction and sequence of events for locking trade funds in escrow on Stellar Testnet.

## 1. End-to-End Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Importer as Verified Importer
    participant Web as Movix Web UI (/orders/[id])
    participant Convex as Convex Backend
    participant Wallet as Freighter Wallet
    participant RPC as Stellar Testnet RPC
    participant Contract as Soroban Escrow Contract v1
    actor Exporter as Verified Exporter

    Importer->>Web: Clicks "Lock Funds in Escrow"
    Web->>Convex: mutation escrowFunding.prepare({ orderId })
    Convex-->>Web: Returns Funding Intent & Contract Arguments
    Web->>Importer: Opens Transaction Review Modal
    Importer->>Web: Clicks "Confirm and Sign with Wallet"
    Web->>RPC: Simulate create_and_fund transaction
    RPC-->>Web: Returns simulation auth tree & gas fees
    Web->>Wallet: Requests signature for create_and_fund XDR
    Wallet-->>Web: Returns signed transaction XDR
    Web->>RPC: Submits signed transaction
    RPC-->>Web: Returns transaction hash
    Web->>Convex: mutation escrowFunding.recordSubmission({ orderId, escrowKey, txHash })
    Convex-->>Web: Sets order settlementStatus to "funding_submitted"
    
    par Background Reconciliation
        Convex->>RPC: Poll transaction finality & get_escrow getter
        RPC-->>Convex: Returns ledger success + verified Escrow struct
        Convex->>Convex: Apply result -> update status to "funded"
        Convex->>Exporter: Trigger "escrow.funded" notification
    end

    Convex-->>Web: Reactive query updates UI to "Funded"
    Web->>Importer: Displays Confirmed On-Chain Escrow Receipt
    Exporter->>Web: Views order detail -> sees identical Confirmed Receipt
```

## 2. Settlement Projection State Machine

```mermaid
stateDiagram-v2
    [*] --> unfunded
    unfunded --> funding_submitted: prepare + wallet submission
    funding_submitted --> funded: Soroban RPC success + get_escrow 100% match
    funding_submitted --> needs_reconciliation: RPC timeout or getter mismatch
    funding_submitted --> unfunded: Terminal transaction failure + no escrow
    needs_reconciliation --> funded: Read-only reconciliation repair match
    needs_reconciliation --> unfunded: Proven terminal failure + no escrow
    funded --> [*]
```
