import { describe, expect, it } from "vitest";

import {
  decodeEscrowContractError,
  decodeEscrowFailure,
  ESCROW_CONTRACT_ERRORS,
} from "./contract-errors.js";

describe("escrow contract errors", () => {
  it("preserves the complete stable 1-20 catalog", () => {
    expect(ESCROW_CONTRACT_ERRORS).toHaveLength(20);
    expect(ESCROW_CONTRACT_ERRORS.map(({ code }) => code)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(ESCROW_CONTRACT_ERRORS[0]).toMatchObject({ code: 1, name: "InvalidConfig" });
    expect(ESCROW_CONTRACT_ERRORS[19]).toMatchObject({ code: 20, name: "NotInitialized" });
  });

  it.each(ESCROW_CONTRACT_ERRORS)("decodes $name from its numeric code", (definition) => {
    expect(decodeEscrowContractError(definition.code)).toMatchObject(definition);
  });

  it("decodes Stellar host contract-error messages", () => {
    expect(decodeEscrowContractError(new Error("Error(Contract, #14)"))).toMatchObject({
      code: 14,
      name: "UnauthorizedParty",
      category: "unauthorized_party",
    });
  });

  it("retains unknown host failures instead of hiding them", () => {
    const original = new Error("transaction simulation failed");
    expect(decodeEscrowFailure(original)).toEqual({
      kind: "host",
      message: "transaction simulation failed",
      original,
    });
  });
});
