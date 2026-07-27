export const organizationRoles = [
  "owner",
  "admin",
  "procurement",
  "finance",
  "operations",
  "viewer",
] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const capabilities = [
  "organization:edit",
  "order:draft",
  "order:send",
  "order:decide",
  "escrow:fund",
  "shipment:record",
  "delivery:confirm",
  "refund:request",
  "refund:approve",
  "transactions:view",
  "audit:view",
] as const;
export type Capability = (typeof capabilities)[number];

const capabilityRoles: Record<Capability, readonly OrganizationRole[]> = {
  "organization:edit": ["owner", "admin"],
  "order:draft": ["owner", "admin", "procurement"],
  "order:send": ["owner", "admin", "procurement"],
  "order:decide": ["owner", "admin", "procurement", "operations"],
  "escrow:fund": ["owner", "admin", "finance"],
  "shipment:record": ["owner", "admin", "operations"],
  "delivery:confirm": ["owner", "admin", "finance", "operations"],
  "refund:request": ["owner", "admin", "procurement", "finance", "operations"],
  "refund:approve": ["owner", "admin", "finance"],
  "transactions:view": organizationRoles,
  "audit:view": organizationRoles,
};

export function roleCan(role: OrganizationRole, capability: Capability): boolean {
  return capabilityRoles[capability].includes(role);
}
