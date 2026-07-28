import { rpc, scValToNative } from "@stellar/stellar-sdk";

export type EscrowStatus =
  | "Funded"
  | "Accepted"
  | "Shipped"
  | "RefundPending"
  | "Released"
  | "Refunded"
  | "Cancelled";

export type EscrowEventType =
  | "configured"
  | "funded"
  | "accepted"
  | "shipped"
  | "released"
  | "refund_proposed"
  | "refund_rejected"
  | "refund_withdrawn"
  | "refunded"
  | "cancelled";

interface EventEnvelope<TType extends EscrowEventType, TPayload> {
  contractId: string;
  ledger: number;
  transactionHash: string;
  type: TType;
  payload: TPayload;
}

export type EscrowEvent =
  | EventEnvelope<
      "configured",
      {
        treasury: string;
        supportedAssetCount: number;
        maxFeeBps: number;
        contractVersion: number;
      }
    >
  | EventEnvelope<
      "funded",
      {
        id: Uint8Array;
        buyer: string;
        supplier: string;
        token: string;
        grossAmount: bigint;
        feeBps: number;
        feeAmount: bigint;
        acceptBy: bigint;
        termsHash: Uint8Array;
        status: "Funded";
      }
    >
  | EventEnvelope<
      "accepted",
      {
        id: Uint8Array;
        supplier: string;
        termsHash: Uint8Array;
        status: "Accepted";
      }
    >
  | EventEnvelope<
      "shipped",
      {
        id: Uint8Array;
        supplier: string;
        shipmentHash: Uint8Array;
        status: "Shipped";
      }
    >
  | EventEnvelope<
      "released",
      {
        id: Uint8Array;
        buyer: string;
        supplier: string;
        treasury: string;
        token: string;
        grossAmount: bigint;
        feeAmount: bigint;
        netAmount: bigint;
        deliveryHash: Uint8Array;
        status: "Released";
      }
    >
  | EventEnvelope<
      "refund_proposed",
      {
        id: Uint8Array;
        proposer: string;
        refundTermsHash: Uint8Array;
        resumeStatus: "Funded" | "Accepted" | "Shipped";
        status: "RefundPending";
      }
    >
  | EventEnvelope<
      "refund_rejected",
      {
        id: Uint8Array;
        proposer: string;
        responder: string;
        refundTermsHash: Uint8Array;
        restoredStatus: "Funded" | "Accepted" | "Shipped";
      }
    >
  | EventEnvelope<
      "refund_withdrawn",
      {
        id: Uint8Array;
        proposer: string;
        refundTermsHash: Uint8Array;
        restoredStatus: "Funded" | "Accepted" | "Shipped";
      }
    >
  | EventEnvelope<
      "refunded",
      {
        id: Uint8Array;
        proposer: string;
        approver: string;
        buyer: string;
        token: string;
        grossAmount: bigint;
        refundTermsHash: Uint8Array;
        status: "Refunded";
      }
    >
  | EventEnvelope<
      "cancelled",
      {
        id: Uint8Array;
        buyer: string;
        token: string;
        grossAmount: bigint;
        acceptBy: bigint;
        status: "Cancelled";
      }
    >;

const TOPIC_FIELDS: Record<EscrowEventType, readonly string[]> = {
  configured: ["treasury"],
  funded: ["id", "buyer", "supplier"],
  accepted: ["id", "supplier"],
  shipped: ["id", "supplier"],
  released: ["id", "buyer", "supplier"],
  refund_proposed: ["id", "proposer"],
  refund_rejected: ["id", "proposer", "responder"],
  refund_withdrawn: ["id", "proposer"],
  refunded: ["id", "proposer", "approver"],
  cancelled: ["id", "buyer"],
};

export function decodeEscrowEvent(event: rpc.Api.EventResponse): EscrowEvent {
  const decodedTopics = event.topic.map((topic) => scValToNative(topic) as unknown);
  const type = decodedTopics[0];
  if (typeof type !== "string" || !(type in TOPIC_FIELDS)) {
    throw new Error(`Unsupported escrow event type: ${String(type)}`);
  }

  const eventType = type as EscrowEventType;
  const data = camelizeRecord(scValToNative(event.value));
  for (const [index, field] of TOPIC_FIELDS[eventType].entries()) {
    data[field] = decodedTopics[index + 1];
  }

  const envelope = {
    contractId: event.contractId?.toString() ?? "",
    ledger: event.ledger,
    transactionHash: event.txHash,
  };

  switch (eventType) {
    case "configured":
      return {
        ...envelope,
        type: eventType,
        payload: {
          treasury: asAddress(data.treasury, "treasury"),
          supportedAssetCount: asNumber(data.supportedAssetCount, "supportedAssetCount"),
          maxFeeBps: asNumber(data.maxFeeBps, "maxFeeBps"),
          contractVersion: asNumber(data.contractVersion, "contractVersion"),
        },
      };
    case "funded":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          buyer: asAddress(data.buyer, "buyer"),
          supplier: asAddress(data.supplier, "supplier"),
          token: asAddress(data.token, "token"),
          grossAmount: asBigInt(data.grossAmount, "grossAmount"),
          feeBps: asNumber(data.feeBps, "feeBps"),
          feeAmount: asBigInt(data.feeAmount, "feeAmount"),
          acceptBy: asBigInt(data.acceptBy, "acceptBy"),
          termsHash: asBytes(data.termsHash, "termsHash"),
          status: expectStatus(data.status, "Funded"),
        },
      };
    case "accepted":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          supplier: asAddress(data.supplier, "supplier"),
          termsHash: asBytes(data.termsHash, "termsHash"),
          status: expectStatus(data.status, "Accepted"),
        },
      };
    case "shipped":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          supplier: asAddress(data.supplier, "supplier"),
          shipmentHash: asBytes(data.shipmentHash, "shipmentHash"),
          status: expectStatus(data.status, "Shipped"),
        },
      };
    case "released":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          buyer: asAddress(data.buyer, "buyer"),
          supplier: asAddress(data.supplier, "supplier"),
          treasury: asAddress(data.treasury, "treasury"),
          token: asAddress(data.token, "token"),
          grossAmount: asBigInt(data.grossAmount, "grossAmount"),
          feeAmount: asBigInt(data.feeAmount, "feeAmount"),
          netAmount: asBigInt(data.netAmount, "netAmount"),
          deliveryHash: asBytes(data.deliveryHash, "deliveryHash"),
          status: expectStatus(data.status, "Released"),
        },
      };
    case "refund_proposed":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          proposer: asAddress(data.proposer, "proposer"),
          refundTermsHash: asBytes(data.refundTermsHash, "refundTermsHash"),
          resumeStatus: expectActiveStatus(data.resumeStatus),
          status: expectStatus(data.status, "RefundPending"),
        },
      };
    case "refund_rejected":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          proposer: asAddress(data.proposer, "proposer"),
          responder: asAddress(data.responder, "responder"),
          refundTermsHash: asBytes(data.refundTermsHash, "refundTermsHash"),
          restoredStatus: expectActiveStatus(data.restoredStatus),
        },
      };
    case "refund_withdrawn":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          proposer: asAddress(data.proposer, "proposer"),
          refundTermsHash: asBytes(data.refundTermsHash, "refundTermsHash"),
          restoredStatus: expectActiveStatus(data.restoredStatus),
        },
      };
    case "refunded":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          proposer: asAddress(data.proposer, "proposer"),
          approver: asAddress(data.approver, "approver"),
          buyer: asAddress(data.buyer, "buyer"),
          token: asAddress(data.token, "token"),
          grossAmount: asBigInt(data.grossAmount, "grossAmount"),
          refundTermsHash: asBytes(data.refundTermsHash, "refundTermsHash"),
          status: expectStatus(data.status, "Refunded"),
        },
      };
    case "cancelled":
      return {
        ...envelope,
        type: eventType,
        payload: {
          id: asBytes(data.id, "id"),
          buyer: asAddress(data.buyer, "buyer"),
          token: asAddress(data.token, "token"),
          grossAmount: asBigInt(data.grossAmount, "grossAmount"),
          acceptBy: asBigInt(data.acceptBy, "acceptBy"),
          status: expectStatus(data.status, "Cancelled"),
        },
      };
  }
}

function camelizeRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Escrow event data must be a map");
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      entry,
    ]),
  );
}

function asAddress(value: unknown, field: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }
  throw new Error(`Escrow event ${field} must be an address`);
}

function asNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  if (
    typeof value === "bigint" &&
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return Number(value);
  }
  throw new Error(`Escrow event ${field} must be a safe integer`);
}

function asBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  throw new Error(`Escrow event ${field} must be an integer`);
}

function asBytes(value: unknown, field: string): Uint8Array {
  if (value instanceof Uint8Array && value.byteLength === 32) {
    return value;
  }
  throw new Error(`Escrow event ${field} must be BytesN<32>`);
}

function expectStatus<T extends EscrowStatus>(value: unknown, expected: T): T {
  const actual = normalizeStatus(value);
  if (actual !== expected) {
    throw new Error(`Escrow event status must be ${expected}`);
  }
  return expected;
}

function expectActiveStatus(value: unknown): "Funded" | "Accepted" | "Shipped" {
  const status = normalizeStatus(value);
  if (status !== "Funded" && status !== "Accepted" && status !== "Shipped") {
    throw new Error("Escrow event resume status must be active");
  }
  return status;
}

function normalizeStatus(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  if (typeof value === "object" && value !== null && "tag" in value) {
    const tag = (value as { tag?: unknown }).tag;
    if (typeof tag === "string") {
      return tag;
    }
  }
  return "";
}
