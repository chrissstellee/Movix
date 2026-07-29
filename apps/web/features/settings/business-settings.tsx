"use client";

import { api, type Id } from "@repo/backend/client";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useState } from "react";

type IdentityForm = { legalName: string; tradingName: string; businessEmail: string };
type ContactForm = {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
};

function mutationError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "data" in error
      ? String((error as { data?: { code?: string } }).data?.code ?? "")
      : "";
  return code === "PROFILE_STALE"
    ? "This section changed elsewhere. The latest server values have been restored."
    : "The update was not accepted. Review the values and try again.";
}

export function BusinessSettings() {
  const context = useQuery(api.organizations.currentContext, {});
  const organizationId = context?.kind === "ready" ? context.organization.id : null;
  const settings = useQuery(
    api.organizations.getBusinessSettings,
    organizationId ? { organizationId } : "skip",
  );
  const updateProfile = useMutation(api.organizations.updateProfile);
  const updateContact = useMutation(api.organizations.updatePrimaryContact);
  const updateAddress = useMutation(api.organizations.updateAddress);
  const [identity, setIdentity] = useState<IdentityForm | null>(null);
  const [contact, setContact] = useState<ContactForm | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    if (!settings) return;
    setIdentity({
      legalName: settings.organization.legalName,
      tradingName: settings.organization.tradingName ?? "",
      businessEmail: settings.organization.businessEmail ?? "",
    });
    setContact(
      settings.primaryContact
        ? {
            name: settings.primaryContact.name,
            email: settings.primaryContact.email,
            phone: settings.primaryContact.phone ?? "",
            jobTitle: settings.primaryContact.jobTitle ?? "",
            department: settings.primaryContact.department ?? "",
          }
        : null,
    );
  }, [settings]);

  if (!settings || !identity) {
    return (
      <p role="status" aria-live="polite">
        Loading business settings…
      </p>
    );
  }

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    if (!settings || !identity) return;
    const settingsSnapshot = settings;
    setSaving("identity");
    setMessage("");
    try {
      await updateProfile({
        organizationId: settingsSnapshot.organization.id,
        expectedVersion: settingsSnapshot.organization.version,
        requestId: crypto.randomUUID(),
        patch: {
          legalName: identity.legalName,
          tradingName: identity.tradingName || null,
          businessEmail: identity.businessEmail,
        },
      });
    } catch (error) {
      setMessage(mutationError(error));
      setIdentity({
        legalName: settingsSnapshot.organization.legalName,
        tradingName: settingsSnapshot.organization.tradingName ?? "",
        businessEmail: settingsSnapshot.organization.businessEmail ?? "",
      });
    } finally {
      setSaving("");
    }
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    if (!settings || !settings.primaryContact || !contact) return;
    const settingsSnapshot = settings;
    const primaryContact = settings.primaryContact;
    setSaving("contact");
    setMessage("");
    try {
      await updateContact({
        organizationId: settingsSnapshot.organization.id,
        contactId: primaryContact.id,
        expectedVersion: primaryContact.version,
        requestId: crypto.randomUUID(),
        patch: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone || null,
          jobTitle: contact.jobTitle || null,
          department: contact.department || null,
        },
      });
    } catch (error) {
      setMessage(mutationError(error));
      setContact({
        name: primaryContact.name,
        email: primaryContact.email,
        phone: primaryContact.phone ?? "",
        jobTitle: primaryContact.jobTitle ?? "",
        department: primaryContact.department ?? "",
      });
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Business settings</h1>
        <p className="mt-2 text-muted-foreground">
          Maintain the organization profile used across Movix.
        </p>
      </div>
      {message ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Update not saved</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {settings.profileReadiness.missing.length ? (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Profile readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {settings.profileReadiness.missing.map((item) => (
                <li key={item.code}>{item.label}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Tabs defaultValue="identity" className="gap-5">
        <div className="overflow-x-auto pb-1">
          <TabsList aria-label="Business settings sections" className="min-w-max">
            <TabsTrigger value="identity">Business identity</TabsTrigger>
            <TabsTrigger value="contact" disabled={!contact || !settings.primaryContact}>
              Primary contact
            </TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle>Business identity</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-5 sm:grid-cols-2" onSubmit={saveIdentity}>
                <SettingsField
                  id="settings-legal"
                  label="Legal name"
                  value={identity.legalName}
                  setValue={(legalName) => setIdentity({ ...identity, legalName })}
                  required
                />
                <SettingsField
                  id="settings-trading"
                  label="Trading name"
                  value={identity.tradingName}
                  setValue={(tradingName) => setIdentity({ ...identity, tradingName })}
                />
                <div className="sm:col-span-2">
                  <SettingsField
                    id="settings-email"
                    label="Business email"
                    type="email"
                    value={identity.businessEmail}
                    setValue={(businessEmail) => setIdentity({ ...identity, businessEmail })}
                    required
                  />
                </div>
                <Actions
                  busy={saving === "identity"}
                  cancel={() =>
                    setIdentity({
                      legalName: settings.organization.legalName,
                      tradingName: settings.organization.tradingName ?? "",
                      businessEmail: settings.organization.businessEmail ?? "",
                    })
                  }
                />
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="contact">
          {contact && settings.primaryContact ? (
            <Card>
              <CardHeader>
                <CardTitle>Primary contact</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-5 sm:grid-cols-2" onSubmit={saveContact}>
                  <SettingsField
                    id="settings-contact-name"
                    label="Name"
                    value={contact.name}
                    setValue={(name) => setContact({ ...contact, name })}
                    required
                  />
                  <SettingsField
                    id="settings-contact-email"
                    label="Email"
                    type="email"
                    value={contact.email}
                    setValue={(email) => setContact({ ...contact, email })}
                    required
                  />
                  <SettingsField
                    id="settings-contact-phone"
                    label="Phone"
                    value={contact.phone}
                    setValue={(phone) => setContact({ ...contact, phone })}
                  />
                  <SettingsField
                    id="settings-job"
                    label="Job title"
                    value={contact.jobTitle}
                    setValue={(jobTitle) => setContact({ ...contact, jobTitle })}
                  />
                  <SettingsField
                    id="settings-department"
                    label="Department"
                    value={contact.department}
                    setValue={(department) => setContact({ ...contact, department })}
                  />
                  <Actions
                    busy={saving === "contact"}
                    cancel={() =>
                      setContact({
                        name: settings.primaryContact!.name,
                        email: settings.primaryContact!.email,
                        phone: settings.primaryContact!.phone ?? "",
                        jobTitle: settings.primaryContact!.jobTitle ?? "",
                        department: settings.primaryContact!.department ?? "",
                      })
                    }
                  />
                </form>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        <TabsContent value="addresses">
          <div className="grid gap-4">
            {settings.addresses.map((address) => (
              <AddressEditor
                key={address.id}
                address={address}
                organizationId={settings.organization.id}
                updateAddress={updateAddress}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsField({
  id,
  label,
  value,
  setValue,
  required,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required={required}
        type={type}
      />
    </div>
  );
}

function Actions({ busy, cancel }: { busy: boolean; cancel: () => void }) {
  return (
    <div className="flex justify-end gap-3 sm:col-span-2">
      <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function AddressEditor({
  address,
  organizationId,
  updateAddress,
}: {
  address: {
    id: Id<"addresses">;
    type: string;
    label: string;
    recipientName: string;
    line1: string;
    city: string;
    region?: string;
    postalCode?: string;
    countryCode: string;
    version: bigint;
  };
  organizationId: Id<"organizations">;
  updateAddress: ReturnType<typeof useMutation<typeof api.organizations.updateAddress>>;
}) {
  const original = {
    recipientName: address.recipientName,
    line1: address.line1,
    city: address.city,
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
  };
  const [form, setForm] = useState(original);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(
    () => setForm(original),
    [
      address.recipientName,
      address.line1,
      address.city,
      address.region,
      address.postalCode,
      address.countryCode,
    ],
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateAddress({
        organizationId,
        addressId: address.id,
        expectedVersion: address.version,
        requestId: crypto.randomUUID(),
        patch: { ...form, region: form.region || null, postalCode: form.postalCode || null },
      });
    } catch (error) {
      setForm(original);
      setMessage(mutationError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="capitalize">{address.type} address</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5 sm:grid-cols-2" onSubmit={save}>
          {message ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {message}
            </p>
          ) : null}
          <SettingsField
            id={`${address.id}-recipient`}
            label="Recipient"
            value={form.recipientName}
            setValue={(recipientName) => setForm({ ...form, recipientName })}
            required
          />
          <SettingsField
            id={`${address.id}-line1`}
            label="Address line 1"
            value={form.line1}
            setValue={(line1) => setForm({ ...form, line1 })}
            required
          />
          <SettingsField
            id={`${address.id}-city`}
            label="City"
            value={form.city}
            setValue={(city) => setForm({ ...form, city })}
            required
          />
          <SettingsField
            id={`${address.id}-region`}
            label="Region"
            value={form.region}
            setValue={(region) => setForm({ ...form, region })}
          />
          <SettingsField
            id={`${address.id}-postal`}
            label="Postal code"
            value={form.postalCode}
            setValue={(postalCode) => setForm({ ...form, postalCode })}
          />
          <SettingsField
            id={`${address.id}-country`}
            label="Country code"
            value={form.countryCode}
            setValue={(countryCode) => setForm({ ...form, countryCode: countryCode.toUpperCase() })}
            required
          />
          <Actions busy={busy} cancel={() => setForm(original)} />
        </form>
      </CardContent>
    </Card>
  );
}
