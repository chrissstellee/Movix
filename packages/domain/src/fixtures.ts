export const FIXED_NOW = 1_735_689_600_000;

export const buyerUser = {
  walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  status: "active",
  timezone: "UTC",
} as const;

export const supplierUser = {
  walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  status: "active",
  timezone: "UTC",
} as const;

export const testnetUsdc = {
  code: "USDC",
  decimals: 7,
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  network: "testnet",
} as const;

export const draftOrder = {
  purchaseOrderNumber: "MOVIX-PO-0001",
  buyerOrganizationKey: "buyer-org",
  supplierOrganizationKey: "supplier-org",
  asset: testnetUsdc,
  lines: [
    { lineNumber: 1, quantity: 2n, unitPriceBaseUnits: 125_000_000n },
    { lineNumber: 2, quantity: 3n, unitPriceBaseUnits: 72_500_000n },
  ],
  totalBaseUnits: 467_500_000n,
  createdAt: FIXED_NOW,
} as const;

export const termsHash = "b10f8837c0d04f6be1f43364c8af0b0e256beb457f8dca1290bcda70ba7f3593";

export const invalidFixtures = {
  samePartyOrder: {
    ...draftOrder,
    supplierOrganizationKey: draftOrder.buyerOrganizationKey,
  },
  negativeAmount: -1n,
  staleVersion: 0,
  wrongNetworkAsset: { ...testnetUsdc, network: "mainnet" },
} as const;
