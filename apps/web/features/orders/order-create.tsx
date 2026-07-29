"use client";

import { api, type Id } from "@repo/backend/client";
import { formatBaseAmount } from "@repo/stellar/amounts";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { orderAmount } from "./order-format";
import { parseOrderMoney, parseTaxPercent } from "./order-input";
import { useSerializedAutosave } from "./use-serialized-autosave";

const orderSteps = ["Supplier", "Details", "Items", "Terms", "Review"] as const;

export function OrderCreate() {
  const router = useRouter();
  const search = useSearchParams();
  const rawOrderId = search.get("orderId");
  const orderId = rawOrderId as Id<"orders"> | null;
  const create = useMutation(api.orderDrafts.create);
  const saveSupplier = useMutation(api.orderDrafts.saveSupplier);
  const saveHeader = useMutation(api.orderDrafts.saveHeader);
  const upsertLine = useMutation(api.orderDrafts.upsertLine);
  const removeLine = useMutation(api.orderDrafts.removeLine);
  const saveTerms = useMutation(api.orderDrafts.saveTerms);
  const send = useMutation(api.orders.send);
  const context = useQuery(api.organizations.currentContext, {});
  const settings = useQuery(
    api.organizations.getBusinessSettings,
    context?.kind === "ready" ? { organizationId: context.organization.id } : "skip",
  );
  const draft = useQuery(api.orderDrafts.get, orderId ? { orderId } : "skip");
  const review = useQuery(api.orderDrafts.getReview, orderId ? { orderId } : "skip");
  const version = useRef<bigint>(1n);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState(0);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const sendKey = useRef<string | null>(null);
  const creating = useRef(false);
  const autosave = useSerializedAutosave();

  useEffect(() => {
    if (orderId || creating.current) return;
    creating.current = true;
    void create({ idempotencyKey: crypto.randomUUID() })
      .then((result) => router.replace(`/orders/new?orderId=${result.orderId}`))
      .catch(() => {
        creating.current = false;
        setError("The draft could not be created. Retry from the orders page.");
      });
  }, [create, orderId, router]);

  useEffect(() => {
    if (draft) version.current = draft.revision.version;
  }, [draft]);

  function perform(task: (expectedVersion: bigint) => Promise<{ version: bigint }>) {
    return async () => {
      setError("");
      const result = await task(version.current);
      version.current = result.version;
    };
  }

  async function saveHeaderForm(form: HTMLFormElement, expectedVersion: bigint) {
    if (!orderId || !settings?.primaryContact) throw new Error("Profile is incomplete");
    const billing =
      settings.addresses.find((address) => address.type === "billing") ?? settings.addresses[0];
    const shipping =
      settings.addresses.find((address) => address.type === "shipping") ?? settings.addresses[0];
    if (!billing || !shipping) throw new Error("Profile is incomplete");
    const data = new FormData(form);
    return saveHeader({
      orderId,
      expectedVersion,
      purchaseOrderNumber: text(data, "purchaseOrderNumber"),
      title: text(data, "title"),
      description: optional(data, "description"),
      buyerContactId: settings.primaryContact.id,
      billingAddressId: billing.id,
      shippingAddressId: shipping.id,
      orderDate: text(data, "orderDate"),
      issueDate: text(data, "issueDate"),
      requestedDeliveryDate: text(data, "requestedDeliveryDate"),
      supplierAcceptanceDeadline: Date.parse(text(data, "supplierAcceptanceDeadline")),
      fundingDeadline: Date.parse(text(data, "fundingDeadline")),
      assetKey: text(data, "assetKey") as "testnet:XLM" | "testnet:USDC",
      buyerInternalNotes: optional(data, "buyerInternalNotes"),
    });
  }

  if (!orderId || draft === undefined || settings === undefined) {
    return <p role="status">Creating secure server-side draft…</p>;
  }

  const editable = draft.order.agreementStatus === "draft";
  const today = localDateValue(0);
  const deadline =
    draft.revision.supplierAcceptanceDeadline === undefined
      ? localDateTimeValue(86_400_000)
      : localDateTimeFromTimestamp(draft.revision.supplierAcceptanceDeadline);
  const funding =
    draft.revision.fundingDeadline === undefined
      ? localDateTimeValue(172_800_000)
      : localDateTimeFromTimestamp(draft.revision.fundingDeadline);
  const delivery = localDateValue(604_800_000);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Buyer procurement</p>
          <h1 className="mt-1 text-3xl font-semibold">Create purchase order</h1>
          <p className="mt-2 text-muted-foreground">
            Sending freezes these terms and notifies the supplier. It moves no funds.
          </p>
        </div>
        <SaveStatus
          state={autosave.state}
          failureMessage={autosave.failureMessage}
          retry={autosave.retry}
          reload={() => location.reload()}
        />
      </header>
      {error ? (
        <div role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3">
          {error}
        </div>
      ) : null}

      <nav aria-label="Order creation progress">
        <ol className="grid grid-cols-5 gap-2">
          {orderSteps.map((step, index) => {
            const completed = [
              Boolean(draft.revision.supplierLegalName),
              Boolean(
                draft.revision.purchaseOrderNumber && draft.revision.title && draft.revision.asset,
              ),
              draft.lines.length > 0,
              Boolean(draft.revision.deliveryMethod && draft.revision.refundPolicy),
              Boolean(review?.complete),
            ][index];
            return (
              <li key={step}>
                <button
                  type="button"
                  aria-current={activeSection === index ? "step" : undefined}
                  className={`w-full rounded-md border p-2 text-left text-xs sm:p-3 ${
                    activeSection === index ? "border-primary bg-primary/10" : ""
                  }`}
                  onClick={() => setActiveSection(index)}
                >
                  <span className="block font-medium">
                    <span className="sm:hidden">{index + 1}</span>
                    <span className="hidden sm:inline">
                      {index + 1}. {step}
                    </span>
                  </span>
                  <span className="mt-1 hidden text-muted-foreground md:block">
                    {completed
                      ? "Complete"
                      : activeSection === index
                        ? "In progress"
                        : "Not started"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          Step {activeSection + 1} of 5: {orderSteps[activeSection]}
        </p>
      </nav>

      {activeSection === 0 ? (
        <Section number="1" title="Supplier">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              autosave.runNow(
                perform(async (expectedVersion) => {
                  const result = await saveSupplier({
                    orderId,
                    expectedVersion,
                    target: { kind: "wallet", walletAddress: text(data, "walletAddress") },
                  });
                  setActiveSection(1);
                  return result;
                }),
              );
            }}
          >
            <div>
              <Label htmlFor="walletAddress">Supplier’s Stellar Testnet wallet address</Label>
              <Input
                id="walletAddress"
                name="walletAddress"
                required
                pattern="^G[A-Z2-7]{55}$"
                placeholder="Paste the supplier address beginning with G"
                autoComplete="off"
                disabled={!editable}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We use an exact verified address. Other organizations cannot browse this lookup.
              </p>
            </div>
            <Button className="self-end" type="submit" disabled={!editable}>
              Resolve supplier
            </Button>
            {draft.revision.supplierLegalName ? (
              <div
                role="status"
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm sm:col-span-2"
              >
                <span className="font-medium">Supplier selected</span>
                <span className="ml-2">{draft.revision.supplierLegalName}</span>
              </div>
            ) : null}
          </form>
        </Section>
      ) : null}

      {activeSection === 1 ? (
        <Section number="2" title="Order details">
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- delegated blur schedules one validated form snapshot */}
          <form
            className="grid gap-4 sm:grid-cols-2"
            onBlur={(event) => {
              const form = event.currentTarget;
              if (form.checkValidity()) {
                autosave.schedule(
                  perform((expectedVersion) => saveHeaderForm(form, expectedVersion)),
                );
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              autosave.runNow(
                perform(async (expectedVersion) => {
                  const result = await saveHeaderForm(form, expectedVersion);
                  setActiveSection(2);
                  return result;
                }),
              );
            }}
          >
            <Field
              label="PO number"
              name="purchaseOrderNumber"
              required
              defaultValue={draft.revision.purchaseOrderNumber}
            />
            <Field label="Title" name="title" required defaultValue={draft.revision.title} />
            <Field
              label="Order date"
              name="orderDate"
              type="date"
              required
              defaultValue={draft.revision.orderDate ?? today}
            />
            <Field
              label="Issue date"
              name="issueDate"
              type="date"
              required
              defaultValue={draft.revision.issueDate ?? today}
            />
            <Field
              label="Requested delivery"
              name="requestedDeliveryDate"
              type="date"
              required
              defaultValue={draft.revision.requestedDeliveryDate ?? delivery}
            />
            <Field
              label="Supplier acceptance deadline"
              name="supplierAcceptanceDeadline"
              type="datetime-local"
              required
              defaultValue={deadline}
            />
            <Field
              label="Funding deadline"
              name="fundingDeadline"
              type="datetime-local"
              required
              defaultValue={funding}
            />
            <label className="space-y-1 text-sm">
              <span>Settlement asset</span>
              <select
                name="assetKey"
                defaultValue={draft.revision.asset?.key ?? "testnet:XLM"}
                className="h-9 w-full rounded-md border bg-background px-3"
              >
                <option value="testnet:XLM">Testnet XLM</option>
                <option value="testnet:USDC">Testnet USDC</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={draft.revision.description}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="buyerInternalNotes">
                Internal buyer notes (never included in supplier terms)
              </Label>
              <Textarea
                id="buyerInternalNotes"
                name="buyerInternalNotes"
                defaultValue={draft.revision.buyerInternalNotes}
              />
            </div>
            <ProfileSnapshot settings={settings} />
            <Button type="button" variant="ghost" onClick={() => setActiveSection(0)}>
              Back
            </Button>
            <Button type="submit" variant="outline" disabled={!editable}>
              Save and continue
            </Button>
          </form>
        </Section>
      ) : null}

      {activeSection === 2 ? (
        <Section number="3" title="Items">
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              autosave.runNow(
                perform(async (expectedVersion) => {
                  const result = await upsertLine({
                    orderId,
                    expectedVersion,
                    line: {
                      lineNumber: BigInt(draft.lines.length + 1),
                      name: text(data, "name"),
                      quantityCoefficient: BigInt(text(data, "quantity")),
                      quantityScale: 0n,
                      unitOfMeasure: text(data, "unitOfMeasure"),
                      unitPriceBaseUnits: parseOrderMoney(text(data, "unitPrice")),
                      discountKind: "none",
                      taxBps: parseTaxPercent(text(data, "taxPercent")),
                      requiresInspection: data.get("requiresInspection") === "on",
                    },
                  });
                  form.reset();
                  return result;
                }),
              );
            }}
          >
            <Field label="Item name" name="name" required />
            <Field label="Quantity" name="quantity" type="number" min="1" required />
            <Field label="Unit" name="unitOfMeasure" defaultValue="unit" required />
            <Field
              label={`Unit price (${draft.revision.asset?.code ?? "asset"})`}
              name="unitPrice"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
            <Field
              label="Tax (%)"
              name="taxPercent"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              defaultValue="0"
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiresInspection" /> Requires inspection
            </label>
            <Button type="submit" disabled={!editable}>
              Add item
            </Button>
          </form>
          <ul className="mt-5 grid gap-3" aria-label="Order items">
            {draft.lines.map((line) => (
              <li key={line.id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-4">
                <Fact label="Item" value={`${line.lineNumber.toString()}. ${line.name}`} />
                <Fact
                  label="Quantity"
                  value={`${line.quantityCoefficient.toString()} ${line.unitOfMeasure}`}
                />
                <Fact
                  label="Line total"
                  value={orderAmount(line.lineTotalBaseUnits, draft.revision.asset?.code)}
                  mono
                />
                <span className="sm:text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!editable}
                    aria-label={`Remove ${line.name}`}
                    onClick={() => {
                      if (!confirm(`Remove ${line.name} from this order?`)) return;
                      autosave.runNow(
                        perform((expectedVersion) =>
                          removeLine({ orderId, lineId: line.id, expectedVersion }),
                        ),
                      );
                    }}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap justify-between gap-3 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setActiveSection(1)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={draft.lines.length === 0}
              onClick={() => setActiveSection(3)}
            >
              Continue to terms
            </Button>
          </div>
        </Section>
      ) : null}

      {activeSection === 3 ? (
        <Section number="4" title="Terms">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              autosave.runNow(
                perform(async (expectedVersion) => {
                  const result = await saveTerms({
                    orderId,
                    expectedVersion,
                    deliveryMethod: text(data, "deliveryMethod"),
                    shippingResponsibility: text(data, "shippingResponsibility"),
                    freightChargeTreatment: text(data, "freightChargeTreatment"),
                    inspectionPeriodHours: BigInt(text(data, "inspectionPeriodHours")),
                    refundPolicy: text(data, "refundPolicy"),
                    shippingTotalBaseUnits: parseOrderMoney(text(data, "shippingTotal"), true),
                    acceptanceCriteria: optional(data, "acceptanceCriteria"),
                  });
                  setActiveSection(4);
                  return result;
                }),
              );
            }}
          >
            <Field
              label="Delivery method"
              name="deliveryMethod"
              required
              defaultValue={draft.revision.deliveryMethod ?? "Courier"}
            />
            <Field
              label="Shipping responsibility"
              name="shippingResponsibility"
              required
              defaultValue={draft.revision.shippingResponsibility ?? "Buyer"}
            />
            <Field
              label="Freight treatment"
              name="freightChargeTreatment"
              required
              defaultValue={draft.revision.freightChargeTreatment ?? "Added to order"}
            />
            <Field
              label="Inspection period (hours)"
              name="inspectionPeriodHours"
              type="number"
              min="0"
              max="8760"
              required
              defaultValue={draft.revision.inspectionPeriodHours?.toString() ?? "24"}
            />
            <Field
              label={`Shipping (${draft.revision.asset?.code ?? "asset"})`}
              name="shippingTotal"
              inputMode="decimal"
              min="0"
              required
              defaultValue={formatBaseAmount(draft.revision.totals.shippingTotalBaseUnits, 7)}
            />
            <Field
              label="Refund policy"
              name="refundPolicy"
              required
              defaultValue={draft.revision.refundPolicy ?? "Refund before acceptance"}
            />
            <div className="sm:col-span-2">
              <Label htmlFor="acceptanceCriteria">Acceptance criteria</Label>
              <Textarea
                id="acceptanceCriteria"
                name="acceptanceCriteria"
                defaultValue={draft.revision.acceptanceCriteria}
              />
            </div>
            <Button type="button" variant="ghost" onClick={() => setActiveSection(2)}>
              Back
            </Button>
            <Button type="submit" disabled={!editable}>
              Save and review
            </Button>
          </form>
        </Section>
      ) : null}

      {activeSection === 4 ? (
        <Section number="5" title="Review">
          {!review ? (
            <p role="status">Preparing backend review…</p>
          ) : (
            <div className="space-y-6">
              <ReviewGroup title="Supplier and parties">
                <Fact
                  label="Supplier"
                  value={
                    review.revision.supplierTradingName ??
                    review.revision.supplierLegalName ??
                    "Not selected"
                  }
                />
                <Fact
                  label="Supplier legal name"
                  value={review.revision.supplierLegalName ?? "Not selected"}
                />
                <Fact
                  label="Supplier contact"
                  value={contactLabel(review.revision.supplierContact)}
                />
                <Fact label="Buyer" value={review.revision.buyerLegalName} />
                <Fact label="Buyer contact" value={contactLabel(review.revision.buyerContact)} />
              </ReviewGroup>

              <ReviewGroup title="Order details">
                <Fact
                  label="PO number"
                  value={review.revision.purchaseOrderNumber ?? "Not provided"}
                />
                <Fact label="Title" value={review.revision.title ?? "Not provided"} />
                <Fact label="Description" value={review.revision.description ?? "Not provided"} />
                <Fact label="Order date" value={review.revision.orderDate ?? "Not provided"} />
                <Fact label="Issue date" value={review.revision.issueDate ?? "Not provided"} />
                <Fact
                  label="Requested delivery"
                  value={review.revision.requestedDeliveryDate ?? "Not provided"}
                />
                <Fact
                  label="Supplier acceptance deadline"
                  value={dateTimeLabel(
                    review.revision.supplierAcceptanceDeadline,
                    review.revision.timezone,
                  )}
                />
                <Fact
                  label="Funding deadline"
                  value={dateTimeLabel(review.revision.fundingDeadline, review.revision.timezone)}
                />
                <Fact label="Timezone" value={review.revision.timezone ?? "Not provided"} />
                <Fact
                  label="Settlement asset"
                  value={
                    review.revision.asset
                      ? `${review.revision.asset.code} · Stellar Testnet`
                      : "Not provided"
                  }
                />
                <Fact
                  label="Billing address"
                  value={addressLabel(review.revision.billingAddress)}
                />
                <Fact
                  label="Ship-to address"
                  value={addressLabel(review.revision.shippingAddress)}
                />
              </ReviewGroup>

              <ReviewItems lines={review.lines} assetCode={review.revision.asset?.code} />

              <ReviewGroup title="Terms">
                <Fact
                  label="Delivery method"
                  value={review.revision.deliveryMethod ?? "Not provided"}
                />
                <Fact
                  label="Shipping responsibility"
                  value={review.revision.shippingResponsibility ?? "Not provided"}
                />
                <Fact
                  label="Freight treatment"
                  value={review.revision.freightChargeTreatment ?? "Not provided"}
                />
                <Fact
                  label="Inspection period"
                  value={
                    review.revision.inspectionPeriodHours === undefined
                      ? "Not provided"
                      : `${review.revision.inspectionPeriodHours.toString()} hours`
                  }
                />
                <Fact
                  label="Refund policy"
                  value={review.revision.refundPolicy ?? "Not provided"}
                />
                <Fact
                  label="Acceptance criteria"
                  value={review.revision.acceptanceCriteria ?? "Not provided"}
                />
                <Fact
                  label="Shipping amount"
                  value={orderAmount(
                    review.totals.shippingTotalBaseUnits,
                    review.revision.asset?.code,
                  )}
                  mono
                />
              </ReviewGroup>

              {review.revision.buyerInternalNotes ? (
                <section className="rounded-lg border border-dashed p-4">
                  <h3 className="font-semibold">Buyer-only notes</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This content is not shared with the supplier or included in the terms hash.
                  </p>
                  <p className="mt-3 text-sm whitespace-pre-wrap">
                    {review.revision.buyerInternalNotes}
                  </p>
                </section>
              ) : null}

              <ReviewGroup title="Totals">
                <Fact
                  label="Subtotal"
                  value={orderAmount(review.totals.subtotalBaseUnits, review.revision.asset?.code)}
                  mono
                />
                <Fact
                  label="Discounts"
                  value={orderAmount(
                    review.totals.discountTotalBaseUnits,
                    review.revision.asset?.code,
                  )}
                  mono
                />
                <Fact
                  label="Tax"
                  value={orderAmount(review.totals.taxTotalBaseUnits, review.revision.asset?.code)}
                  mono
                />
                <Fact
                  label="Shipping"
                  value={orderAmount(
                    review.totals.shippingTotalBaseUnits,
                    review.revision.asset?.code,
                  )}
                  mono
                />
                <Fact
                  label="Grand total"
                  value={orderAmount(
                    review.totals.grandTotalBaseUnits,
                    review.revision.asset?.code,
                  )}
                  mono
                />
              </ReviewGroup>

              <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
                <Fact label="Network" value="Stellar Testnet" />
                <Fact
                  label="Terms hash preview"
                  value={review.termsHash ? shortHash(review.termsHash) : "Available when complete"}
                  mono
                />
              </div>
              {review.blockers.length ? (
                <div role="alert" className="rounded-md border border-amber-500/40 p-4">
                  <p className="font-medium">Resolve before sending</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {review.blockers.map((blocker) => (
                      <li key={blocker.field}>
                        <button
                          type="button"
                          className="text-left underline"
                          onClick={() => setActiveSection(sectionForBlocker(blocker.field))}
                        >
                          {blocker.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Sending creates no Stellar transaction, signature request, escrow, or movement of
                funds.
              </p>
              <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
                <Button type="button" variant="ghost" onClick={() => setActiveSection(3)}>
                  Back
                </Button>
                <Button
                  disabled={!review.complete || !editable}
                  onClick={() => setConfirmSend(true)}
                >
                  Review and send
                </Button>
              </div>
            </div>
          )}
        </Section>
      ) : null}
      {confirmSend && review ? (
        <SendConfirmation
          supplier={review.revision.supplierLegalName ?? "Supplier"}
          po={review.revision.purchaseOrderNumber ?? "Draft order"}
          total={orderAmount(review.totals.grandTotalBaseUnits, review.revision.asset?.code)}
          sending={sending}
          cancel={() => setConfirmSend(false)}
          confirm={() => {
            setSending(true);
            autosave.runNow(async () => {
              try {
                const result = await send({
                  orderId,
                  expectedVersion: version.current,
                  idempotencyKey: (sendKey.current ??= crypto.randomUUID()),
                });
                router.push(`/orders/${result.orderId}`);
              } finally {
                setSending(false);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">
          {number}. {title}
        </h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm break-all" : "text-sm"}>{value}</span>
    </div>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ReviewItems({
  lines,
  assetCode,
}: {
  lines: Array<{
    id: Id<"orderLines">;
    lineNumber: bigint;
    name: string;
    quantityCoefficient: bigint;
    quantityScale: bigint;
    unitOfMeasure: string;
    unitPriceBaseUnits: bigint;
    discountBaseUnits: bigint;
    taxBaseUnits: bigint;
    requiresInspection: boolean;
    lineTotalBaseUnits: bigint;
  }>;
  assetCode?: "XLM" | "USDC";
}) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="font-semibold">Items</h3>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-3 font-medium">Item</th>
              <th className="px-2 py-3 font-medium">Quantity</th>
              <th className="px-2 py-3 font-medium">Unit price</th>
              <th className="px-2 py-3 font-medium">Discount</th>
              <th className="px-2 py-3 font-medium">Tax</th>
              <th className="px-2 py-3 font-medium">Inspection</th>
              <th className="px-2 py-3 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="px-2 py-3">
                  {line.lineNumber.toString()}. {line.name}
                </td>
                <td className="px-2 py-3">
                  {quantityLabel(line.quantityCoefficient, line.quantityScale)} {line.unitOfMeasure}
                </td>
                <td className="px-2 py-3 font-mono">
                  {orderAmount(line.unitPriceBaseUnits, assetCode)}
                </td>
                <td className="px-2 py-3 font-mono">
                  {orderAmount(line.discountBaseUnits, assetCode)}
                </td>
                <td className="px-2 py-3 font-mono">{orderAmount(line.taxBaseUnits, assetCode)}</td>
                <td className="px-2 py-3">{line.requiresInspection ? "Required" : "No"}</td>
                <td className="px-2 py-3 text-right font-mono">
                  {orderAmount(line.lineTotalBaseUnits, assetCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-3 md:hidden">
        {lines.map((line) => (
          <li key={line.id} className="rounded-md bg-muted/40 p-4">
            <p className="font-medium break-words">
              {line.lineNumber.toString()}. {line.name}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Fact
                label="Quantity"
                value={`${quantityLabel(line.quantityCoefficient, line.quantityScale)} ${line.unitOfMeasure}`}
              />
              <Fact
                label="Unit price"
                value={orderAmount(line.unitPriceBaseUnits, assetCode)}
                mono
              />
              <Fact label="Discount" value={orderAmount(line.discountBaseUnits, assetCode)} mono />
              <Fact label="Tax" value={orderAmount(line.taxBaseUnits, assetCode)} mono />
              <Fact label="Inspection" value={line.requiresInspection ? "Required" : "No"} />
              <Fact
                label="Line total"
                value={orderAmount(line.lineTotalBaseUnits, assetCode)}
                mono
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function contactLabel(contact?: Record<string, string | null>) {
  if (!contact) return "Not provided";
  return [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ") || "Not provided";
}

function addressLabel(address?: Record<string, string | null>) {
  if (!address) return "Not provided";
  return [
    address.label,
    address.recipientName,
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.countryCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function dateTimeLabel(timestamp?: number, timezone?: string) {
  if (timestamp === undefined) return "Not provided";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function quantityLabel(coefficient: bigint, scale: bigint) {
  if (scale === 0n) return coefficient.toString();
  const digits = Number(scale);
  const negative = coefficient < 0n;
  const absolute = (negative ? -coefficient : coefficient).toString().padStart(digits + 1, "0");
  const value = `${absolute.slice(0, -digits)}.${absolute.slice(-digits)}`.replace(
    /(?:\.0+|(\.\d+?)0+)$/u,
    "$1",
  );
  return negative ? `-${value}` : value;
}

function SaveStatus({
  state,
  failureMessage,
  retry,
  reload,
}: {
  state: ReturnType<typeof useSerializedAutosave>["state"];
  failureMessage: string;
  retry: () => void;
  reload: () => void;
}) {
  const labels = {
    draft: "Draft created",
    saved: "Saved",
    saving: "Saving…",
    unsaved: "Unsaved changes",
    failed: "Save failed",
    stale: "Stale — reload latest",
  };
  return (
    <div className="max-w-sm text-right">
      <div className="flex items-center justify-end gap-2">
        <Badge role="status" aria-live="polite" variant="outline">
          {labels[state]}
        </Badge>
        {state === "failed" ? (
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            Retry save
          </Button>
        ) : null}
        {state === "stale" ? (
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Reload latest
          </Button>
        ) : null}
      </div>
      {failureMessage ? <p className="mt-1 text-xs text-destructive">{failureMessage}</p> : null}
    </div>
  );
}

function ProfileSnapshot({
  settings,
}: {
  settings: {
    primaryContact: { name: string; email: string } | null;
    addresses: Array<{ type: string; label: string; city: string }>;
  };
}) {
  const billing = settings.addresses.find((address) => address.type === "billing");
  const shipping = settings.addresses.find((address) => address.type === "shipping");
  return (
    <div className="grid gap-3 rounded-md bg-muted/40 p-4 sm:col-span-2 sm:grid-cols-3">
      <Fact
        label="Buyer contact"
        value={settings.primaryContact?.name ?? "Complete in business settings"}
      />
      <Fact
        label="Billing address"
        value={billing ? `${billing.label}, ${billing.city}` : "Using registered address"}
      />
      <Fact
        label="Ship-to address"
        value={shipping ? `${shipping.label}, ${shipping.city}` : "Using registered address"}
      />
    </div>
  );
}

function SendConfirmation({
  supplier,
  po,
  total,
  sending,
  cancel,
  confirm,
}: {
  supplier: string;
  po: string;
  total: string;
  sending: boolean;
  cancel: () => void;
  confirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-order-title"
        className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl"
      >
        <h2 id="send-order-title" className="text-xl font-semibold">
          Send this purchase order?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sending freezes revision 1 and notifies the supplier. No funds move and no wallet
          signature is requested.
        </p>
        <div className="mt-5 grid gap-3 rounded-md bg-muted/40 p-4 sm:grid-cols-2">
          <Fact label="Supplier" value={supplier} />
          <Fact label="PO number" value={po} />
          <Fact label="Total" value={total} mono />
          <Fact label="Network" value="Stellar Testnet" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={sending} onClick={cancel}>
            Keep editing
          </Button>
          <Button type="button" disabled={sending} onClick={confirm}>
            {sending ? "Sending…" : "Confirm and send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function optional(data: FormData, name: string) {
  const value = text(data, name);
  return value || undefined;
}

function localDateTimeValue(offset: number) {
  return localDateTimeFromTimestamp(Date.now() + offset);
}

function localDateTimeFromTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateValue(offset: number) {
  return localDateTimeValue(offset).slice(0, 10);
}

function sectionForBlocker(field: string) {
  if (field.startsWith("supplier")) return 0;
  if (field === "lines" || field === "totals") return 2;
  if (
    [
      "deliveryMethod",
      "shippingResponsibility",
      "freightChargeTreatment",
      "inspectionPeriodHours",
      "refundPolicy",
    ].includes(field)
  ) {
    return 3;
  }
  return 1;
}

function shortHash(value: string) {
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}
