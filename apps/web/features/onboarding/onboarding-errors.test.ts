import { describe, expect, it } from "vitest";

import { identityFieldErrors, onboardingErrorDetails } from "./business-onboarding";

describe("onboarding error details", () => {
  it("preserves safe field errors for accessible inline rendering", () => {
    expect(
      onboardingErrorDetails({
        data: {
          code: "DRAFT_INVALID",
          fields: { businessEmail: "Enter a valid business email address." },
        },
      }),
    ).toEqual({
      message: "Enter a valid business email address.",
      fields: { businessEmail: "Enter a valid business email address." },
    });
  });

  it("falls back to the stable code message without exposing server details", () => {
    expect(onboardingErrorDetails({ data: { code: "DRAFT_STALE" } })).toEqual({
      message: "This draft changed in another tab. Reload the latest version before continuing.",
      fields: {},
    });
  });

  it("catches identity errors before submitting the Convex mutation", () => {
    expect(
      identityFieldErrors({
        legalName: "A",
        registrationCountry: "PH",
        businessEmail: "owner@localhost",
        website: "example.com",
        businessPhone: "123",
        defaultTimezone: "Asia/Manila",
      }),
    ).toEqual({
      legalName: "Enter a legal business name between 2 and 160 characters.",
      businessEmail: "Enter a valid business email address.",
      website: "Enter a complete http:// or https:// website URL.",
      businessPhone: "Enter a valid phone number for the registration country.",
    });
  });
});
