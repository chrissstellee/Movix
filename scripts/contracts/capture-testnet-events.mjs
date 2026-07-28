import { rpc, scValToNative } from "@stellar/stellar-sdk";

if (process.argv.slice(2).includes("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/capture-testnet-events.mjs <contract-id> <start-ledger>\n",
  );
  process.exit(0);
}

const [contractId, startLedgerText] = process.argv.slice(2);
if (!contractId || !startLedgerText) {
  throw new Error(
    "Usage: node scripts/contracts/capture-testnet-events.mjs <contract-id> <start-ledger>",
  );
}

const startLedger = Number.parseInt(startLedgerText, 10);
if (!Number.isSafeInteger(startLedger) || startLedger < 1) {
  throw new Error(`Invalid start ledger: ${startLedgerText}`);
}

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const response = await server.getEvents({
  startLedger,
  filters: [{ type: "contract", contractIds: [contractId] }],
  limit: 100,
});

const events = response.events.map((event) => ({
  id: event.id,
  ledger: event.ledger,
  ledgerClosedAt: event.ledgerClosedAt,
  transactionHash: event.txHash,
  successfulCall: event.inSuccessfulContractCall,
  rawXdr: {
    topics: event.topic.map((topic) => topic.toXDR("base64")),
    value: event.value.toXDR("base64"),
  },
  decoded: {
    topics: event.topic.map(scValToNative).map(jsonSafe),
    value: jsonSafe(scValToNative(event.value)),
  },
}));

process.stdout.write(
  `${JSON.stringify(
    {
      schemaVersion: 1,
      network: "testnet",
      rpcUrl: "https://soroban-testnet.stellar.org",
      contractId,
      startLedger,
      latestLedger: response.latestLedger,
      cursor: response.cursor,
      eventCount: events.length,
      events,
    },
    null,
    2,
  )}\n`,
);

function jsonSafe(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(jsonSafe);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}
