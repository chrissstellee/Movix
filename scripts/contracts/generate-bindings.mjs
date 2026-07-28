import {
  BINDINGS_DIR,
  hasFlag,
  relativeToRepo,
  RELEASE_WASM,
  requireFile,
  run,
  sha256Directory,
} from "./_shared.mjs";

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/generate-bindings.mjs [--dry-run]\n" +
      "Generates TypeScript bindings only from the local release WASM.\n",
  );
  process.exit(0);
}

const dryRun = hasFlag("--dry-run");
if (!dryRun) {
  requireFile(RELEASE_WASM, "Release WASM");
}

run(
  "stellar",
  [
    "contract",
    "bindings",
    "typescript",
    "--wasm",
    relativeToRepo(RELEASE_WASM),
    "--output-dir",
    relativeToRepo(BINDINGS_DIR),
    "--overwrite",
  ],
  { dryRun },
);

if (!dryRun) {
  process.stdout.write(
    `${JSON.stringify(
      {
        bindingsPath: relativeToRepo(BINDINGS_DIR),
        sha256: sha256Directory(BINDINGS_DIR),
      },
      null,
      2,
    )}\n`,
  );
}
