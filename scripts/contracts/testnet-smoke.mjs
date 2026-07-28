import { hasFlag, requireEnv, run } from "./_shared.mjs";
import { runLifecycleSmoke } from "./_smoke.mjs";

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/testnet-smoke.mjs [--execute]\n" +
      "Requires MOVIX_ENABLE_TESTNET_SMOKE=1, contract/token IDs, and CLI identity aliases.\n",
  );
  process.exit(0);
}

if (!hasFlag("--execute")) {
  process.stdout.write("Dry run only. Add --execute with the documented testnet environment.\n");
  process.exit(0);
}
if (process.env.MOVIX_ENABLE_TESTNET_SMOKE !== "1") {
  throw new Error("Set MOVIX_ENABLE_TESTNET_SMOKE=1 to acknowledge testnet mutations");
}

const buyerIdentity = requireEnv("MOVIX_TESTNET_BUYER_IDENTITY");
const supplierIdentity = requireEnv("MOVIX_TESTNET_SUPPLIER_IDENTITY");
const contractId = requireEnv("MOVIX_TESTNET_ESCROW_CONTRACT_ID");
const token = requireEnv("MOVIX_TESTNET_SMOKE_TOKEN");
const buyerAddress = publicKey(buyerIdentity);
const supplierAddress = publicKey(supplierIdentity);

await runLifecycleSmoke({
  network: "testnet",
  contractId,
  buyerIdentity,
  supplierIdentity,
  buyerAddress,
  supplierAddress,
  token,
  cancellationWaitSeconds: 12,
  seedOffset: 40,
});

function publicKey(identity) {
  return run("stellar", ["keys", "public-key", identity], { capture: true }).stdout.trim();
}
