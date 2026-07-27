import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const organizationCapabilities = ["buyer", "supplier", "buyer_supplier"] as const;
export type OrganizationCapability = (typeof organizationCapabilities)[number];

export const organizationEntityTypes = [
  "sole_proprietor",
  "partnership",
  "corporation",
  "limited_company",
  "nonprofit",
  "government",
  "other",
] as const;
export type OrganizationEntityType = (typeof organizationEntityTypes)[number];

export const contactTypes = [
  "general",
  "procurement",
  "accounts_payable",
  "sales",
  "shipping",
  "legal",
] as const;
export type ContactType = (typeof contactTypes)[number];

export const addressTypes = ["registered", "billing", "shipping"] as const;
export type AddressType = (typeof addressTypes)[number];

export const onboardingSteps = ["identity", "contact", "address", "preferences", "review"] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export const businessErrorCodes = [
  "UNAUTHENTICATED",
  "USER_INACTIVE",
  "ONBOARDING_ALREADY_COMPLETED",
  "DRAFT_NOT_FOUND",
  "DRAFT_STALE",
  "DRAFT_INVALID",
  "ATTESTATION_REQUIRED",
  "BUSINESS_DUPLICATE",
  "MEMBERSHIP_INACTIVE",
  "ORGANIZATION_INACTIVE",
  "ORGANIZATION_FORBIDDEN",
  "PROFILE_STALE",
  "FIELD_INVALID",
  "MULTIPLE_ORGANIZATIONS_UNSUPPORTED",
  "INTERNAL_ERROR",
] as const;
export type BusinessErrorCode = (typeof businessErrorCodes)[number];

export const BUSINESS_ATTESTATION_VERSION = "business-profile-v1";
export const BUSINESS_ATTESTATION_TEXT =
  "I am authorized to create this business profile and confirm the information is accurate.";

// Checked-in ISO 3166-1 alpha-2 registry. Labels are rendered with Intl.DisplayNames.
export const isoCountryCodes = [
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
] as const;

const isoCountryCodeSet = new Set<string>(isoCountryCodes);

function invalid(): never {
  throw new Error("FIELD_INVALID");
}

export function collapseBusinessWhitespace(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeBusinessName(value: string): {
  display: string;
  comparison: string;
} {
  const display = collapseBusinessWhitespace(value);
  if (display.length < 2 || display.length > 160 || /[\p{Cc}\p{Cf}]/u.test(display)) {
    invalid();
  }
  return { display, comparison: display.toLocaleLowerCase("und") };
}

export function normalizeBusinessEmail(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 254 || /\s/u.test(trimmed)) {
    invalid();
  }
  const separator = trimmed.lastIndexOf("@");
  if (separator <= 0 || separator === trimmed.length - 1) {
    invalid();
  }
  const local = trimmed.slice(0, separator);
  const domain = trimmed.slice(separator + 1).toLowerCase();
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    invalid();
  }
  return `${local}@${domain}`;
}

export function normalizeCountryCode(value: string): (typeof isoCountryCodes)[number] {
  const code = value.trim().toUpperCase();
  if (!isoCountryCodeSet.has(code)) {
    invalid();
  }
  return code as (typeof isoCountryCodes)[number];
}

export function validateTimezone(value: string): string {
  const timezone = value.trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
  } catch {
    invalid();
  }
  if (!timezone.includes("/")) {
    invalid();
  }
  return timezone;
}

export function validateBusinessUrl(value: string): string {
  if (value.length > 2_048) {
    invalid();
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    invalid();
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    invalid();
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function normalizePhone(value: string, countryCode: string): string {
  const country = normalizeCountryCode(countryCode);
  const phone = parsePhoneNumberFromString(value.trim(), country as CountryCode);
  if (!phone?.isValid()) {
    invalid();
  }
  return phone.number;
}

export interface BusinessAddressInput {
  recipientName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  countryCode: string;
  deliveryInstructions?: string | null;
}

export interface NormalizedBusinessAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: (typeof isoCountryCodes)[number];
  deliveryInstructions?: string;
}

function normalizeBoundedText(value: string, minimum: number, maximum: number): string {
  const normalized = collapseBusinessWhitespace(value);
  if (
    normalized.length < minimum ||
    normalized.length > maximum ||
    /[\p{Cc}\p{Cf}]/u.test(normalized)
  ) {
    invalid();
  }
  return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }
  return normalizeBoundedText(value, 1, maximum);
}

export function validateAddress(input: BusinessAddressInput): NormalizedBusinessAddress {
  const countryCode = normalizeCountryCode(input.countryCode);
  const region = optionalText(input.region, 120);
  const postalCode = optionalText(input.postalCode, 32);
  if (countryCode === "PH" && (!region || !postalCode || !/^\d{4}$/u.test(postalCode))) {
    invalid();
  }

  return {
    recipientName: normalizeBoundedText(input.recipientName, 2, 160),
    line1: normalizeBoundedText(input.line1, 2, 200),
    ...(optionalText(input.line2, 200) ? { line2: optionalText(input.line2, 200) } : {}),
    city: normalizeBoundedText(input.city, 1, 120),
    ...(region ? { region } : {}),
    ...(postalCode ? { postalCode } : {}),
    countryCode,
    ...(optionalText(input.deliveryInstructions, 500)
      ? { deliveryInstructions: optionalText(input.deliveryInstructions, 500) }
      : {}),
  };
}

export type ProfileRequirement =
  | "ORGANIZATION_FIELDS_REQUIRED"
  | "PRIMARY_CONTACT_REQUIRED"
  | "REGISTERED_ADDRESS_REQUIRED";

export interface ProfileReadinessItem {
  code: ProfileRequirement;
  label: string;
  settingsPath: string;
  requiredFor: ("organization" | "buyer" | "supplier")[];
}

export interface ProfileReadiness {
  organizationUsable: boolean;
  buyerReady: boolean;
  supplierReady: boolean;
  missing: ProfileReadinessItem[];
}

export function computeProfileReadiness(input: {
  hasRequiredOrganizationFields: boolean;
  hasPrimaryContact: boolean;
  hasRegisteredAddress: boolean;
  capability: OrganizationCapability;
}): ProfileReadiness {
  const missing: ProfileReadinessItem[] = [];
  if (!input.hasRequiredOrganizationFields) {
    missing.push({
      code: "ORGANIZATION_FIELDS_REQUIRED",
      label: "Complete the required business identity fields",
      settingsPath: "/settings/business#identity",
      requiredFor: ["organization", "buyer", "supplier"],
    });
  }
  if (!input.hasPrimaryContact) {
    missing.push({
      code: "PRIMARY_CONTACT_REQUIRED",
      label: "Add a primary contact",
      settingsPath: "/settings/business#contact",
      requiredFor: ["organization", "buyer", "supplier"],
    });
  }
  if (!input.hasRegisteredAddress) {
    missing.push({
      code: "REGISTERED_ADDRESS_REQUIRED",
      label: "Add a registered address",
      settingsPath: "/settings/business#registered-address",
      requiredFor: ["organization", "buyer", "supplier"],
    });
  }

  const organizationUsable = missing.length === 0;
  return {
    organizationUsable,
    buyerReady:
      organizationUsable && (input.capability === "buyer" || input.capability === "buyer_supplier"),
    supplierReady:
      organizationUsable &&
      (input.capability === "supplier" || input.capability === "buyer_supplier"),
    missing,
  };
}

export function destinationForCapability(
  capability: OrganizationCapability,
): "/buyer" | "/supplier" {
  return capability === "supplier" ? "/supplier" : "/buyer";
}
