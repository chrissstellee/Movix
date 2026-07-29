export function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Awaiting Exporter",
    accepted: "Accepted",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

export function orderAmount(value: bigint, assetCode?: "XLM" | "USDC") {
  if (!assetCode) return "Asset not selected";
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString().padStart(8, "0");
  const whole = digits.slice(0, -7);
  const fractional = digits.slice(-7).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${whole}${fractional ? `.${fractional}` : ""} ${assetCode}`;
}
