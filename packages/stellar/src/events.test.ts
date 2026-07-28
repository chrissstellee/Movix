import { Address, Contract, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { TESTNET_XLM_CONTRACT } from "./config.js";
import { decodeEscrowEvent } from "./events.js";

describe("escrow event decoder", () => {
  it("decodes a funded event into the stable normalized shape", () => {
    const id = Buffer.alloc(32, 1);
    const termsHash = Buffer.alloc(32, 2);
    const buyer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();
    const supplier = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 4)).publicKey();
    const token = TESTNET_XLM_CONTRACT;

    const decoded = decodeEscrowEvent({
      id: "0000000000000001-0000000000",
      type: "contract",
      ledger: 123,
      ledgerClosedAt: "2026-07-28T00:00:00Z",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      txHash: "a".repeat(64),
      contractId: new Contract(token),
      topic: [
        xdr.ScVal.scvSymbol("funded"),
        nativeToScVal(id),
        new Address(buyer).toScVal(),
        new Address(supplier).toScVal(),
      ],
      value: nativeToScVal({
        token,
        gross_amount: 100n,
        fee_bps: 100,
        fee_amount: 1n,
        accept_by: 2_000n,
        terms_hash: termsHash,
        status: "Funded",
      }),
    });

    expect(decoded).toMatchObject({
      contractId: token,
      ledger: 123,
      transactionHash: "a".repeat(64),
      type: "funded",
      payload: {
        buyer,
        supplier,
        token,
        grossAmount: 100n,
        feeBps: 100,
        feeAmount: 1n,
        acceptBy: 2_000n,
        status: "Funded",
      },
    });
    expect(decoded.type).toBe("funded");
    if (decoded.type !== "funded") {
      throw new Error("Expected funded event");
    }
    expect(decoded.payload.id).toEqual(id);
  });

  it.each([
    {
      type: "configured",
      topics: [new Address(Keypair.random().publicKey()).toScVal()],
      value: {
        supported_asset_count: 2,
        max_fee_bps: 100,
        contract_version: 1,
      },
    },
    {
      type: "accepted",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: { terms_hash: Buffer.alloc(32, 2), status: "Accepted" },
    },
    {
      type: "shipped",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: { shipment_hash: Buffer.alloc(32, 3), status: "Shipped" },
    },
    {
      type: "released",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: {
        treasury: Keypair.random().publicKey(),
        token: TESTNET_XLM_CONTRACT,
        gross_amount: 100n,
        fee_amount: 1n,
        net_amount: 99n,
        delivery_hash: Buffer.alloc(32, 4),
        status: "Released",
      },
    },
    {
      type: "refund_proposed",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: {
        refund_terms_hash: Buffer.alloc(32, 5),
        resume_status: "Shipped",
        status: "RefundPending",
      },
    },
    {
      type: "refund_rejected",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: {
        refund_terms_hash: Buffer.alloc(32, 5),
        restored_status: "Accepted",
      },
    },
    {
      type: "refund_withdrawn",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: {
        refund_terms_hash: Buffer.alloc(32, 5),
        restored_status: "Funded",
      },
    },
    {
      type: "refunded",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: {
        buyer: Keypair.random().publicKey(),
        token: TESTNET_XLM_CONTRACT,
        gross_amount: 100n,
        refund_terms_hash: Buffer.alloc(32, 5),
        status: "Refunded",
      },
    },
    {
      type: "cancelled",
      topics: [
        nativeToScVal(Buffer.alloc(32, 1)),
        new Address(Keypair.random().publicKey()).toScVal(),
      ],
      value: {
        token: TESTNET_XLM_CONTRACT,
        gross_amount: 100n,
        accept_by: 2_000n,
        status: "Cancelled",
      },
    },
  ])("decodes the $type event catalog entry", ({ type, topics, value }) => {
    const decoded = decodeEscrowEvent({
      id: "0000000000000001-0000000000",
      type: "contract",
      ledger: 123,
      ledgerClosedAt: "2026-07-28T00:00:00Z",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      txHash: "c".repeat(64),
      contractId: new Contract(TESTNET_XLM_CONTRACT),
      topic: [xdr.ScVal.scvSymbol(type), ...topics],
      value: nativeToScVal(value),
    });

    expect(decoded.type).toBe(type);
  });

  it("rejects unknown events instead of silently accepting ABI drift", () => {
    expect(() =>
      decodeEscrowEvent({
        id: "1",
        type: "contract",
        ledger: 1,
        ledgerClosedAt: "2026-07-28T00:00:00Z",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        txHash: "b".repeat(64),
        topic: [xdr.ScVal.scvSymbol("unexpected")],
        value: nativeToScVal({}),
      }),
    ).toThrow("Unsupported escrow event type");
  });
});
