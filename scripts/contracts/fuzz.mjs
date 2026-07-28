import { hasFlag, printCommand, run } from "./_shared.mjs";

const TARGETS = ["funding", "lifecycle"];
const RUNS = process.env.MOVIX_FUZZ_RUNS ?? "10000";
const SEED = process.env.MOVIX_FUZZ_SEED ?? "3551879746";
const TOOLCHAIN =
  process.env.MOVIX_FUZZ_TOOLCHAIN ??
  (process.platform === "win32" ? "+nightly-x86_64-pc-windows-gnu" : "+nightly");

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/fuzz.mjs [--execute]\n" +
      "Runs deterministic cargo-fuzz targets. Override MOVIX_FUZZ_RUNS and MOVIX_FUZZ_SEED when needed.\n",
  );
  process.exit(0);
}

for (const target of TARGETS) {
  const args = [
    TOOLCHAIN,
    "fuzz",
    "run",
    target,
    "--fuzz-dir",
    "contracts/escrow/fuzz",
    "--",
    `-runs=${RUNS}`,
    `-seed=${SEED}`,
  ];
  if (hasFlag("--execute")) {
    run("cargo", args);
  } else {
    printCommand("cargo", args);
  }
}

if (!hasFlag("--execute")) {
  process.stdout.write("Dry run only. Add --execute after installing cargo-fuzz and nightly Rust.\n");
}
