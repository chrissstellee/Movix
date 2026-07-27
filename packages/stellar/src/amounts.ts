export const MAX_CONVEX_AMOUNT = 9_223_372_036_854_775_807n;

export interface ParseAmountOptions {
  allowZero?: boolean;
  maxBaseUnits?: bigint;
}

export function parseDisplayAmount(
  value: string,
  decimals: number,
  options: ParseAmountOptions = {},
): bigint {
  assertDecimals(decimals);

  if (!/^(0|[1-9]\d*)(?:\.(\d+))?$/.test(value)) {
    throw new Error("Amount must be a plain non-negative decimal string");
  }

  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places`);
  }

  const scale = 10n ** BigInt(decimals);
  const paddedFraction = fraction.padEnd(decimals, "0");
  const baseUnits = BigInt(whole) * scale + BigInt(paddedFraction || "0");
  const maximum = options.maxBaseUnits ?? MAX_CONVEX_AMOUNT;

  if (!options.allowZero && baseUnits === 0n) {
    throw new Error("Amount must be greater than zero");
  }
  if (baseUnits > maximum) {
    throw new Error("Amount exceeds the supported base-unit range");
  }

  return baseUnits;
}

export function formatBaseAmount(value: bigint, decimals: number): string {
  assertDecimals(decimals);
  if (value < 0n) {
    throw new Error("Amount cannot be negative");
  }

  if (decimals === 0) {
    return value.toString();
  }

  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Decimals must be an integer between 0 and 18");
  }
}
