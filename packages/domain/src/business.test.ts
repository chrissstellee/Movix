import { describe, expect, it } from "vitest";

import {
  computeProfileReadiness,
  normalizeBusinessEmail,
  normalizeBusinessName,
  normalizePhone,
  validateAddress,
  validateBusinessUrl,
  validateTimezone,
} from "./business.js";

describe("business normalization", () => {
  it("preserves display case while normalizing Unicode and whitespace", () => {
    expect(normalizeBusinessName("  Acme\u00a0\u00a0Supply  ")).toEqual({
      display: "Acme Supply",
      comparison: "acme supply",
    });
    expect(normalizeBusinessName("  Café Ñ  ")).toEqual({
      display: "Café Ñ",
      comparison: "café ñ",
    });
  });

  it("normalizes only the email domain", () => {
    expect(normalizeBusinessEmail(" Owner@EXAMPLE.COM ")).toBe("Owner@example.com");
    expect(() => normalizeBusinessEmail("not-an-email")).toThrow("FIELD_INVALID");
  });

  it("accepts canonical timezones and safe absolute URLs", () => {
    expect(validateTimezone("Asia/Manila")).toBe("Asia/Manila");
    expect(() => validateTimezone("UTC+8")).toThrow("FIELD_INVALID");
    expect(validateBusinessUrl("HTTPS://Example.COM/path")).toBe("https://example.com/path");
    expect(() => validateBusinessUrl("javascript:alert(1)")).toThrow("FIELD_INVALID");
    expect(() => validateBusinessUrl("https://user:pass@example.com")).toThrow("FIELD_INVALID");
  });

  it("normalizes supported phone values to E.164", () => {
    expect(normalizePhone("0917 123 4567", "PH")).toBe("+639171234567");
    expect(() => normalizePhone("123", "PH")).toThrow("FIELD_INVALID");
  });
});

describe("country-aware addresses", () => {
  const base = {
    recipientName: "Acme Supply",
    line1: "123 Main Street",
    city: "Makati",
  };

  it("requires Philippine region and a four-digit postal code", () => {
    expect(
      validateAddress({
        ...base,
        countryCode: "PH",
        region: "Metro Manila",
        postalCode: "1200",
      }),
    ).toMatchObject({ countryCode: "PH", postalCode: "1200" });

    expect(() =>
      validateAddress({ ...base, countryCode: "PH", region: "", postalCode: "1200" }),
    ).toThrow("FIELD_INVALID");
    expect(() =>
      validateAddress({
        ...base,
        countryCode: "PH",
        region: "Metro Manila",
        postalCode: "120",
      }),
    ).toThrow("FIELD_INVALID");
  });

  it("uses base requirements for other valid ISO countries", () => {
    expect(validateAddress({ ...base, countryCode: "SG" })).toMatchObject({
      countryCode: "SG",
    });
    expect(() => validateAddress({ ...base, countryCode: "ZZ" })).toThrow("FIELD_INVALID");
  });
});

describe("profile readiness", () => {
  it("keeps optional fields from blocking a complete buyer", () => {
    expect(
      computeProfileReadiness({
        hasRequiredOrganizationFields: true,
        hasPrimaryContact: true,
        hasRegisteredAddress: true,
        capability: "buyer",
      }),
    ).toEqual({
      organizationUsable: true,
      buyerReady: true,
      supplierReady: false,
      missing: [],
    });
  });

  it("returns actionable missing requirements", () => {
    const readiness = computeProfileReadiness({
      hasRequiredOrganizationFields: true,
      hasPrimaryContact: false,
      hasRegisteredAddress: false,
      capability: "buyer_supplier",
    });

    expect(readiness.organizationUsable).toBe(false);
    expect(readiness.missing.map((item) => item.code)).toEqual([
      "PRIMARY_CONTACT_REQUIRED",
      "REGISTERED_ADDRESS_REQUIRED",
    ]);
  });
});
