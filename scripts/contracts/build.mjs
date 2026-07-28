import { statSync } from "node:fs";

import { hasFlag, relativeToRepo, RELEASE_WASM, requireFile, run, sha256File } from "./_shared.mjs";

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/build.mjs [--dry-run]\n" +
      "Builds the locked optimized escrow WASM and fails if optimization is skipped.\n",
  );
  process.exit(0);
}

const dryRun = hasFlag("--dry-run");
const result = run(
  "stellar",
  [
    "contract",
    "build",
    "--manifest-path",
    "contracts/Cargo.toml",
    "--locked",
    "--optimize",
    "true",
  ],
  { capture: !dryRun, dryRun },
);

if (dryRun) {
  process.exit(0);
}

const output = `${result.stdout}\n${result.stderr}`;
process.stdout.write(output);
if (/optim(?:ization|ize)[^\n]*(?:skip|unavailable|disabled)/i.test(output)) {
  throw new Error("Release build did not optimize the WASM");
}

requireFile(RELEASE_WASM, "Release WASM");
process.stdout.write(
  `${JSON.stringify(
    {
      wasmPath: relativeToRepo(RELEASE_WASM),
      sizeBytes: statSync(RELEASE_WASM).size,
      sha256: sha256File(RELEASE_WASM),
    },
    null,
    2,
  )}\n`,
);
