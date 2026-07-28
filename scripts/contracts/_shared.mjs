import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "../..");
export const RELEASE_WASM = resolve(
  REPO_ROOT,
  "contracts/target/wasm32v1-none/release/movix_escrow.wasm",
);
export const BINDINGS_DIR = resolve(REPO_ROOT, "packages/stellar/generated/escrow");
export const TESTNET_MANIFEST = resolve(REPO_ROOT, "deployments/stellar/testnet/escrow-v1.json");

export function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

export function printCommand(command, args) {
  process.stdout.write(`${[command, ...args].map(quoteArg).join(" ")}\n`);
}

export function run(command, args, options = {}) {
  if (options.dryRun) {
    printCommand(command, args);
    return { stdout: "", stderr: "" };
  }

  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} exited with ${result.status}${details ? `\n${details}` : ""}`);
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function requireFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} does not exist: ${path}`);
  }
}

export function readJson(path) {
  requireFile(path, "JSON file");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable is not set: ${name}`);
  }
  return value;
}

export function sha256File(path) {
  requireFile(path, "File");
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sha256Directory(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`Directory does not exist: ${path}`);
  }

  const hash = createHash("sha256");
  for (const file of listFiles(path)) {
    hash.update(file.slice(path.length + 1).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function relativeToRepo(path) {
  return path.slice(REPO_ROOT.length + 1).replaceAll("\\", "/");
}

function listFiles(path) {
  return readdirSync(path, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const child = resolve(path, entry.name);
      return entry.isDirectory() ? listFiles(child) : [child];
    });
}

function quoteArg(value) {
  return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : JSON.stringify(value);
}
