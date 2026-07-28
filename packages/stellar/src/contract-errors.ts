export const ESCROW_CONTRACT_ERRORS = [
  { code: 1, name: "InvalidConfig", category: "invalid_config" },
  { code: 2, name: "UnsupportedAsset", category: "unsupported_asset" },
  { code: 3, name: "InvalidAmount", category: "invalid_amount" },
  { code: 4, name: "SameParty", category: "same_party" },
  { code: 5, name: "EscrowExists", category: "escrow_exists" },
  { code: 6, name: "EscrowNotFound", category: "escrow_not_found" },
  { code: 7, name: "InvalidTransition", category: "invalid_transition" },
  { code: 8, name: "ArithmeticFailure", category: "arithmetic_failure" },
  { code: 9, name: "FeeTooHigh", category: "fee_too_high" },
  { code: 10, name: "InvalidDeadline", category: "invalid_deadline" },
  { code: 11, name: "AcceptanceExpired", category: "acceptance_expired" },
  { code: 12, name: "CancellationTooEarly", category: "cancellation_too_early" },
  { code: 13, name: "TermsMismatch", category: "terms_mismatch" },
  { code: 14, name: "UnauthorizedParty", category: "unauthorized_party" },
  { code: 15, name: "SamePartyApproval", category: "same_party_approval" },
  { code: 16, name: "RefundTermsMismatch", category: "refund_terms_mismatch" },
  { code: 17, name: "RefundProposerMismatch", category: "refund_proposer_mismatch" },
  { code: 18, name: "InvariantViolation", category: "invariant_violation" },
  { code: 19, name: "InvalidHash", category: "invalid_hash" },
  { code: 20, name: "NotInitialized", category: "not_initialized" },
] as const;

export type EscrowContractErrorCode = (typeof ESCROW_CONTRACT_ERRORS)[number]["code"];
export type EscrowContractErrorName = (typeof ESCROW_CONTRACT_ERRORS)[number]["name"];
export type EscrowContractErrorCategory = (typeof ESCROW_CONTRACT_ERRORS)[number]["category"];

export interface DecodedEscrowContractError {
  kind: "contract";
  code: EscrowContractErrorCode;
  name: EscrowContractErrorName;
  category: EscrowContractErrorCategory;
  original: unknown;
}

export interface DecodedHostError {
  kind: "host";
  message: string;
  original: unknown;
}

export type DecodedEscrowFailure = DecodedEscrowContractError | DecodedHostError;

const ERROR_BY_CODE = new Map<number, (typeof ESCROW_CONTRACT_ERRORS)[number]>(
  ESCROW_CONTRACT_ERRORS.map((entry) => [entry.code, entry]),
);

export function decodeEscrowContractError(error: unknown): DecodedEscrowContractError | null {
  const code = extractContractErrorCode(error);
  const definition = code === null ? undefined : ERROR_BY_CODE.get(code);
  if (!definition) {
    return null;
  }

  return {
    kind: "contract",
    code: definition.code,
    name: definition.name,
    category: definition.category,
    original: error,
  };
}

export function decodeEscrowFailure(error: unknown): DecodedEscrowFailure {
  const contractError = decodeEscrowContractError(error);
  if (contractError) {
    return contractError;
  }

  return {
    kind: "host",
    message: error instanceof Error ? error.message : String(error),
    original: error,
  };
}

function extractContractErrorCode(error: unknown): number | null {
  if (typeof error === "number") {
    return error;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") {
      return code;
    }
  }

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const match =
    /Error\(Contract,\s*#(\d+)\)/i.exec(message) ??
    /contract(?:\s+error)?(?:\s+code)?[:#\s]+(\d+)/i.exec(message);
  return match?.[1] ? Number(match[1]) : null;
}
