import { parseDisplayAmount } from "@repo/stellar/amounts";

export function parseOrderMoney(value: string, allowZero = false) {
  return parseDisplayAmount(value.trim(), 7, { allowZero });
}

export function parseTaxPercent(value: string) {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/u.exec(normalized);
  if (!match) {
    throw new Error("Tax percentage supports at most 2 decimal places");
  }
  const whole = BigInt(match[1]!);
  const fractional = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const bps = whole * 100n + fractional;
  if (bps > 10_000n) throw new Error("Tax percentage cannot exceed 100");
  return bps;
}
