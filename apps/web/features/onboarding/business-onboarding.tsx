"use client";

import { useMovixAuth } from "@/core/auth/auth-context";
import { api } from "@repo/backend/client";
import {
  BUSINESS_ATTESTATION_TEXT,
  BUSINESS_ATTESTATION_VERSION,
  isoCountryCodes,
  type OnboardingStep,
  type OrganizationCapability,
} from "@repo/domain/business";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AddressForm = {
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  deliveryInstructions: string;
};

type OnboardingForm = {
  legalName: string;
  tradingName: string;
  entityType:
    | ""
    | "sole_proprietor"
    | "partnership"
    | "corporation"
    | "limited_company"
    | "nonprofit"
    | "government"
    | "other";
  registrationNumber: string;
  taxId: string;
  industry: string;
  website: string;
  businessPhone: string;
  registrationCountry: string;
  businessEmail: string;
  capability: OrganizationCapability;
  defaultTimezone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  jobTitle: string;
  department: string;
  registeredAddress: AddressForm;
  sameBillingAsRegistered: boolean;
  sameShippingAsRegistered: boolean;
  billingAddress: AddressForm;
  shippingAddress: AddressForm;
};

const steps: Array<{ id: OnboardingStep; label: string }> = [
  { id: "identity", label: "Business" },
  { id: "contact", label: "Contact" },
  { id: "address", label: "Addresses" },
  { id: "preferences", label: "Workspace" },
  { id: "review", label: "Review" },
];

const emptyAddress = (): AddressForm => ({
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "PH",
  deliveryInstructions: "",
});

const initialForm = (): OnboardingForm => ({
  legalName: "",
  tradingName: "",
  entityType: "",
  registrationNumber: "",
  taxId: "",
  industry: "",
  website: "",
  businessPhone: "",
  registrationCountry: "PH",
  businessEmail: "",
  capability: "buyer",
  defaultTimezone: "Asia/Manila",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  jobTitle: "",
  department: "",
  registeredAddress: emptyAddress(),
  sameBillingAsRegistered: true,
  sameShippingAsRegistered: true,
  billingAddress: emptyAddress(),
  shippingAddress: emptyAddress(),
});

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function errorMessage(error: unknown) {
  const fields =
    typeof error === "object" && error !== null && "data" in error
      ? (error as { data?: { fields?: Record<string, string> } }).data?.fields
      : undefined;
  const fieldMessage = fields ? Object.values(fields)[0] : undefined;
  if (fieldMessage) return fieldMessage;

  const code =
    typeof error === "object" && error !== null && "data" in error
      ? String((error as { data?: { code?: string } }).data?.code ?? "")
      : "";
  const messages: Record<string, string> = {
    DRAFT_STALE: "This draft changed in another tab. Reload the latest version before continuing.",
    DRAFT_INVALID: "Review the highlighted step. One or more values are missing or invalid.",
    BUSINESS_DUPLICATE: "A matching active business is already registered.",
    ONBOARDING_ALREADY_COMPLETED: "Onboarding was already completed. Opening your workspace…",
    MULTIPLE_ORGANIZATIONS_UNSUPPORTED:
      "This account has multiple active organizations. Contact support before continuing.",
  };
  return (
    messages[code] ?? "We could not save this step. Your previous saved version is still safe."
  );
}

function addressPayload(address: AddressForm) {
  return {
    recipientName: address.recipientName,
    line1: address.line1,
    line2: optional(address.line2),
    city: address.city,
    region: optional(address.region),
    postalCode: optional(address.postalCode),
    countryCode: address.countryCode,
    deliveryInstructions: optional(address.deliveryInstructions),
  };
}

export function BusinessOnboarding() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const auth = useMovixAuth();
  const router = useRouter();
  const draft = useQuery(api.onboarding.getDraft, isAuthenticated ? {} : "skip");
  const context = useQuery(api.organizations.currentContext, isAuthenticated ? {} : "skip");
  const saveDraft = useMutation(api.onboarding.saveDraft);
  const complete = useMutation(api.onboarding.complete);
  const [form, setForm] = useState<OnboardingForm>(initialForm);
  const [activeStep, setActiveStep] = useState<OnboardingStep>("identity");
  const [version, setVersion] = useState(0n);
  const [status, setStatus] = useState<
    "loading" | "editing" | "saving" | "completing" | "stale" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  const [attested, setAttested] = useState(false);
  const hydratedVersion = useRef<bigint | null>(null);
  const completionKey = useRef<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const destination = useMemo(() => {
    if (context?.kind !== "ready") return null;
    return context.allowedViews.includes("buyer") ? "/buyer" : "/supplier";
  }, [context]);

  useEffect(() => {
    if (!auth.isLoading && !auth.accessToken) router.replace("/login");
  }, [auth.accessToken, auth.isLoading, router]);

  useEffect(() => {
    if (auth.accessToken && !isLoading && !isAuthenticated) {
      void auth.logout().finally(() => router.replace("/login"));
    }
  }, [auth, auth.accessToken, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    if (!draft || hydratedVersion.current === draft.version) return;
    hydratedVersion.current = draft.version;
    setVersion(draft.version);
    if (draft.kind === "completed") {
      setStatus("loading");
      return;
    }
    setActiveStep(draft.currentStep);
    if (draft.kind === "draft") {
      setForm((current) => ({
        ...current,
        ...(draft.identity
          ? {
              legalName: draft.identity.legalName,
              tradingName: draft.identity.tradingName ?? "",
              entityType: draft.identity.entityType ?? "",
              registrationNumber: draft.identity.registrationNumber ?? "",
              taxId: draft.identity.taxId ?? "",
              industry: draft.identity.industry ?? "",
              website: draft.identity.website ?? "",
              businessPhone: draft.identity.businessPhone ?? "",
              registrationCountry: draft.identity.registrationCountry,
              businessEmail: draft.identity.businessEmail,
              capability: draft.identity.capability,
              defaultTimezone: draft.identity.defaultTimezone,
            }
          : {}),
        ...(draft.contact
          ? {
              contactName: draft.contact.name,
              contactEmail: draft.contact.email,
              contactPhone: draft.contact.phone ?? "",
              jobTitle: draft.contact.jobTitle ?? "",
              department: draft.contact.department ?? "",
            }
          : {}),
        ...(draft.registeredAddress
          ? { registeredAddress: { ...emptyAddress(), ...draft.registeredAddress } }
          : {}),
        sameBillingAsRegistered: draft.sameBillingAsRegistered,
        sameShippingAsRegistered: draft.sameShippingAsRegistered,
        ...(draft.billingAddress
          ? { billingAddress: { ...emptyAddress(), ...draft.billingAddress } }
          : {}),
        ...(draft.shippingAddress
          ? { shippingAddress: { ...emptyAddress(), ...draft.shippingAddress } }
          : {}),
      }));
    }
    setStatus("editing");
  }, [draft]);

  useEffect(() => {
    if (status === "editing") firstField.current?.focus();
  }, [activeStep, status]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setStatus("saving");
    try {
      const patch =
        activeStep === "identity"
          ? {
              identity: {
                legalName: form.legalName,
                tradingName: optional(form.tradingName),
                entityType: form.entityType || null,
                registrationNumber: optional(form.registrationNumber),
                taxId: optional(form.taxId),
                industry: optional(form.industry),
                website: optional(form.website),
                businessPhone: optional(form.businessPhone),
                registrationCountry: form.registrationCountry,
                businessEmail: form.businessEmail,
                capability: form.capability,
                defaultTimezone: form.defaultTimezone,
              },
            }
          : activeStep === "contact"
            ? {
                contact: {
                  type: "general" as const,
                  name: form.contactName,
                  email: form.contactEmail,
                  phone: optional(form.contactPhone),
                  jobTitle: optional(form.jobTitle),
                  department: optional(form.department),
                },
              }
            : activeStep === "address"
              ? {
                  address: {
                    registeredAddress: addressPayload(form.registeredAddress),
                    sameBillingAsRegistered: form.sameBillingAsRegistered,
                    sameShippingAsRegistered: form.sameShippingAsRegistered,
                    billingAddress: form.sameBillingAsRegistered
                      ? null
                      : addressPayload(form.billingAddress),
                    shippingAddress: form.sameShippingAsRegistered
                      ? null
                      : addressPayload(form.shippingAddress),
                  },
                }
              : {
                  preferences: {
                    capability: form.capability,
                    defaultTimezone: form.defaultTimezone,
                  },
                };
      const result = await saveDraft({ expectedVersion: version, step: activeStep, patch });
      setVersion(result.version);
      hydratedVersion.current = result.version;
      if (result.kind === "completed") {
        router.refresh();
        return;
      }
      setActiveStep(activeStep === "preferences" ? "review" : result.currentStep);
      setStatus("editing");
    } catch (error) {
      const text = errorMessage(error);
      setMessage(text);
      setStatus(text.includes("another tab") ? "stale" : "error");
    }
  }

  async function finish() {
    if (!attested) {
      setMessage("Confirm the attestation before creating the organization.");
      return;
    }
    setStatus("completing");
    setMessage("");
    try {
      const result = await complete({
        expectedDraftVersion: version,
        completionKey: (completionKey.current ??= crypto.randomUUID()),
        attestationVersion: BUSINESS_ATTESTATION_VERSION,
      });
      router.replace(result.destination);
    } catch (error) {
      const text = errorMessage(error);
      setMessage(text);
      if (text.includes("Opening your workspace")) {
        router.refresh();
      } else {
        setStatus(text.includes("another tab") ? "stale" : "error");
      }
    }
  }

  if (
    auth.isLoading ||
    isLoading ||
    (isAuthenticated && (draft === undefined || context === undefined)) ||
    status === "loading"
  ) {
    return <ProtectedStatus>Loading your secure onboarding draft…</ProtectedStatus>;
  }
  if (!auth.accessToken || !isAuthenticated || destination) return null;
  if (context?.kind === "multiple") {
    return (
      <ProtectedStatus>
        Multiple active organizations are not supported yet. Contact support.
      </ProtectedStatus>
    );
  }

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
            Business onboarding
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Set up your Movix workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Saved steps can be resumed on this authenticated account.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void auth.logout().finally(() => router.replace("/"))}
        >
          Sign out
        </Button>
      </header>

      <ol aria-label="Onboarding progress" className="mb-6 grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <li key={step.id} aria-current={activeStep === step.id ? "step" : undefined}>
            <div
              className={`h-1.5 rounded-full ${steps.findIndex((item) => item.id === activeStep) >= index ? "bg-primary" : "bg-muted"}`}
            />
            <span className="mt-2 hidden text-xs sm:block">{step.label}</span>
          </li>
        ))}
      </ol>

      {message ? (
        <Alert variant="destructive" className="mb-5" role="alert">
          <AlertTitle>{status === "stale" ? "Draft changed" : "Action needed"}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
          {status === "stale" ? (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => location.reload()}>
              Reload latest draft
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{steps.find((step) => step.id === activeStep)?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeStep === "review" ? (
            <ReviewStep
              form={form}
              attested={attested}
              setAttested={setAttested}
              finish={finish}
              back={() => setActiveStep("preferences")}
              busy={status === "completing"}
            />
          ) : (
            <form onSubmit={save} className="space-y-6">
              {activeStep === "identity" ? (
                <IdentityStep form={form} update={update} firstField={firstField} />
              ) : null}
              {activeStep === "contact" ? (
                <ContactStep form={form} update={update} firstField={firstField} />
              ) : null}
              {activeStep === "address" ? (
                <AddressesStep form={form} update={update} firstField={firstField} />
              ) : null}
              {activeStep === "preferences" ? (
                <PreferencesStep form={form} update={update} firstField={firstField} />
              ) : null}
              <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={activeStep === "identity" || status === "saving"}
                  onClick={() =>
                    setActiveStep(
                      steps[Math.max(0, steps.findIndex((step) => step.id === activeStep) - 1)]!.id,
                    )
                  }
                >
                  Back
                </Button>
                <Button type="submit" disabled={status === "saving"}>
                  {status === "saving" ? "Saving…" : "Save and continue"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function ProtectedStatus({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {children}
      </p>
    </main>
  );
}

type StepProps = {
  form: OnboardingForm;
  update: <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => void;
  firstField: React.RefObject<HTMLInputElement | null>;
};

function Field({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  autoComplete,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function IdentityStep({ form, update, firstField }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field
          inputRef={firstField}
          id="legal-name"
          label="Legal business name"
          value={form.legalName}
          onChange={(value) => update("legalName", value)}
          required
          autoComplete="organization"
        />
      </div>
      <Field
        id="trading-name"
        label="Trading name"
        value={form.tradingName}
        onChange={(value) => update("tradingName", value)}
      />
      <div className="space-y-2">
        <Label htmlFor="entity-type">Entity type</Label>
        <select
          id="entity-type"
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          value={form.entityType}
          onChange={(event) =>
            update("entityType", event.target.value as OnboardingForm["entityType"])
          }
        >
          <option value="">Not specified</option>
          <option value="sole_proprietor">Sole proprietor</option>
          <option value="partnership">Partnership</option>
          <option value="corporation">Corporation</option>
          <option value="limited_company">Limited company</option>
          <option value="nonprofit">Nonprofit</option>
          <option value="government">Government</option>
          <option value="other">Other</option>
        </select>
      </div>
      <CountrySelect
        id="country"
        label="Registration country"
        value={form.registrationCountry}
        onChange={(value) => update("registrationCountry", value)}
      />
      <Field
        id="business-email"
        label="Business email"
        value={form.businessEmail}
        onChange={(value) => update("businessEmail", value)}
        required
        type="email"
        autoComplete="email"
      />
      <Field
        id="registration-number"
        label="Registration number"
        value={form.registrationNumber}
        onChange={(value) => update("registrationNumber", value)}
      />
      <Field
        id="tax-id"
        label="Tax ID"
        value={form.taxId}
        onChange={(value) => update("taxId", value)}
      />
      <Field
        id="industry"
        label="Industry"
        value={form.industry}
        onChange={(value) => update("industry", value)}
      />
      <Field
        id="website"
        label="Website"
        value={form.website}
        onChange={(value) => update("website", value)}
        type="url"
        autoComplete="url"
      />
      <Field
        id="business-phone"
        label="Business phone"
        value={form.businessPhone}
        onChange={(value) => update("businessPhone", value)}
        type="tel"
        autoComplete="tel"
      />
    </div>
  );
}

function ContactStep({ form, update, firstField }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field
          inputRef={firstField}
          id="contact-name"
          label="Primary contact name"
          value={form.contactName}
          onChange={(value) => update("contactName", value)}
          required
          autoComplete="name"
        />
      </div>
      <Field
        id="contact-email"
        label="Contact email"
        value={form.contactEmail}
        onChange={(value) => update("contactEmail", value)}
        required
        type="email"
        autoComplete="email"
      />
      <Field
        id="contact-phone"
        label="Contact phone"
        value={form.contactPhone}
        onChange={(value) => update("contactPhone", value)}
        type="tel"
        autoComplete="tel"
      />
      <Field
        id="job-title"
        label="Job title"
        value={form.jobTitle}
        onChange={(value) => update("jobTitle", value)}
        autoComplete="organization-title"
      />
      <Field
        id="department"
        label="Department"
        value={form.department}
        onChange={(value) => update("department", value)}
      />
    </div>
  );
}

function AddressFields({
  prefix,
  title,
  value,
  setValue,
  firstField,
}: {
  prefix: string;
  title: string;
  value: AddressForm;
  setValue: (value: AddressForm) => void;
  firstField?: React.RefObject<HTMLInputElement | null>;
}) {
  const set = (key: keyof AddressForm, next: string) => setValue({ ...value, [key]: next });
  return (
    <fieldset className="grid gap-5 rounded-lg border p-4 sm:grid-cols-2">
      <legend className="px-2 font-medium">{title}</legend>
      <div className="sm:col-span-2">
        <Field
          inputRef={firstField}
          id={`${prefix}-recipient`}
          label="Recipient"
          value={value.recipientName}
          onChange={(next) => set("recipientName", next)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Field
          id={`${prefix}-line1`}
          label="Address line 1"
          value={value.line1}
          onChange={(next) => set("line1", next)}
          required
          autoComplete="address-line1"
        />
      </div>
      <div className="sm:col-span-2">
        <Field
          id={`${prefix}-line2`}
          label="Address line 2"
          value={value.line2}
          onChange={(next) => set("line2", next)}
          autoComplete="address-line2"
        />
      </div>
      <Field
        id={`${prefix}-city`}
        label="City"
        value={value.city}
        onChange={(next) => set("city", next)}
        required
        autoComplete="address-level2"
      />
      <Field
        id={`${prefix}-region`}
        label={`Region${value.countryCode === "PH" ? " *" : ""}`}
        value={value.region}
        onChange={(next) => set("region", next)}
        required={value.countryCode === "PH"}
        autoComplete="address-level1"
      />
      <Field
        id={`${prefix}-postal`}
        label={`Postal code${value.countryCode === "PH" ? " (4 digits)" : ""}`}
        value={value.postalCode}
        onChange={(next) => set("postalCode", next)}
        required={value.countryCode === "PH"}
        autoComplete="postal-code"
      />
      <CountrySelect
        id={`${prefix}-country`}
        label="Country"
        value={value.countryCode}
        onChange={(next) => set("countryCode", next)}
      />
      <div className="sm:col-span-2">
        <Field
          id={`${prefix}-instructions`}
          label="Delivery instructions"
          value={value.deliveryInstructions}
          onChange={(next) => set("deliveryInstructions", next)}
        />
      </div>
    </fieldset>
  );
}

function AddressesStep({ form, update, firstField }: StepProps) {
  return (
    <div className="space-y-5">
      <AddressFields
        prefix="registered"
        title="Registered address"
        value={form.registeredAddress}
        setValue={(value) => update("registeredAddress", value)}
        firstField={firstField}
      />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.sameBillingAsRegistered}
          onChange={(event) => update("sameBillingAsRegistered", event.target.checked)}
        />
        Billing address is the same
      </label>
      {!form.sameBillingAsRegistered ? (
        <AddressFields
          prefix="billing"
          title="Billing address"
          value={form.billingAddress}
          setValue={(value) => update("billingAddress", value)}
        />
      ) : null}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.sameShippingAsRegistered}
          onChange={(event) => update("sameShippingAsRegistered", event.target.checked)}
        />
        Shipping address is the same
      </label>
      {!form.sameShippingAsRegistered ? (
        <AddressFields
          prefix="shipping"
          title="Shipping address"
          value={form.shippingAddress}
          setValue={(value) => update("shippingAddress", value)}
        />
      ) : null}
    </div>
  );
}

function PreferencesStep({ form, update, firstField }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="capability">Workspace capability *</Label>
        <select
          ref={firstField as React.RefObject<HTMLSelectElement | null>}
          id="capability"
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          value={form.capability}
          onChange={(event) => update("capability", event.target.value as OrganizationCapability)}
        >
          <option value="buyer">Buyer</option>
          <option value="supplier">Supplier</option>
          <option value="buyer_supplier">Buyer and supplier</option>
        </select>
      </div>
      <Field
        id="timezone"
        label="Default IANA timezone"
        value={form.defaultTimezone}
        onChange={(value) => update("defaultTimezone", value)}
        required
      />
    </div>
  );
}

function ReviewStep({
  form,
  attested,
  setAttested,
  finish,
  back,
  busy,
}: {
  form: OnboardingForm;
  attested: boolean;
  setAttested: (value: boolean) => void;
  finish: () => void;
  back: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Business</dt>
          <dd className="font-medium">{form.legalName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Capability</dt>
          <dd className="font-medium">{form.capability.replace("_", " + ")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Primary contact</dt>
          <dd className="font-medium">{form.contactName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Registered address</dt>
          <dd className="font-medium">
            {form.registeredAddress.city}, {form.registeredAddress.countryCode}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        New profiles begin as unverified. This status does not claim that Movix or any external
        registry has verified the business.
      </p>
      <label className="flex items-start gap-3 rounded-lg border p-4 text-sm leading-6">
        <input
          className="mt-1"
          type="checkbox"
          checked={attested}
          onChange={(event) => setAttested(event.target.checked)}
        />
        <span>{BUSINESS_ATTESTATION_TEXT}</span>
      </label>
      <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
        <Button variant="ghost" onClick={back} disabled={busy}>
          Back
        </Button>
        <Button onClick={finish} disabled={busy || !attested}>
          {busy ? "Creating workspace…" : "Create organization"}
        </Button>
      </div>
    </div>
  );
}

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function CountrySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <select
        id={id}
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoComplete="country"
      >
        {isoCountryCodes.map((code) => (
          <option key={code} value={code}>
            {countryNames.of(code) ?? code}
          </option>
        ))}
      </select>
    </div>
  );
}
