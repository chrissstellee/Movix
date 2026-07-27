// @vitest-environment node

import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { verifySep10Challenge } from "./sep10";

const homeDomain = "movix.test";
const webAuthDomain = "auth.movix.test";

function operations(server: Keypair, client: Keypair) {
  return [
    Operation.manageData({
      name: `${homeDomain} auth`,
      value: Buffer.alloc(48, 1),
      source: client.publicKey(),
    }),
    Operation.manageData({
      name: "web_auth_domain",
      value: webAuthDomain,
      source: server.publicKey(),
    }),
  ];
}

function customChallenge({
  server,
  client,
  source = server,
  sequence = "-1",
  timebounds,
  challengeOperations = operations(server, client),
  signServer = true,
  clientSigners = [client],
}: {
  server: Keypair;
  client: Keypair;
  source?: Keypair;
  sequence?: string;
  timebounds?: { minTime: number; maxTime: number };
  challengeOperations?: ReturnType<typeof Operation.manageData>[];
  signServer?: boolean;
  clientSigners?: Keypair[];
}) {
  const builder = new TransactionBuilder(new Account(source.publicKey(), sequence), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
    ...(timebounds ? { timebounds } : {}),
  });
  for (const operation of challengeOperations) {
    builder.addOperation(operation);
  }
  const transaction = builder.build();
  if (signServer) {
    transaction.sign(server);
  }
  for (const signer of clientSigners) {
    transaction.sign(signer);
  }
  return transaction.toEnvelope().toXDR("base64").toString();
}

function verify(
  signedTransactionXdr: string,
  server: Keypair,
  client: Keypair,
  now = Date.now(),
  overrides: Partial<Parameters<typeof verifySep10Challenge>[0]> = {},
) {
  return verifySep10Challenge({
    signedTransactionXdr,
    serverAccount: server.publicKey(),
    networkPassphrase: Networks.TESTNET,
    homeDomain,
    webAuthDomain,
    challengeSeconds: 300,
    now,
    threshold: 1,
    signers: [{ key: client.publicKey(), weight: 1, type: "ed25519_public_key" }],
    ...overrides,
  });
}

describe("SEP-10 verification boundary", () => {
  it("accepts a server-signed five-minute Testnet challenge with a stable hash", () => {
    const server = Keypair.random();
    const client = Keypair.random();
    const unsignedXdr = WebAuth.buildChallengeTx(
      server,
      client.publicKey(),
      homeDomain,
      300,
      Networks.TESTNET,
      webAuthDomain,
    );
    const unsigned = TransactionBuilder.fromXDR(unsignedXdr, Networks.TESTNET);
    const before = unsigned.hash().toString("hex");
    unsigned.sign(client);
    const signedXdr = unsigned.toEnvelope().toXDR("base64").toString();

    expect(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET).hash().toString("hex")).toBe(
      before,
    );
    expect(verify(signedXdr, server, client).clientAccountID).toBe(client.publicKey());
  });

  it("rejects malformed XDR and a challenge for the wrong network", () => {
    const server = Keypair.random();
    const client = Keypair.random();
    expect(() => verify("not-xdr", server, client)).toThrow();

    const challenge = WebAuth.buildChallengeTx(
      server,
      client.publicKey(),
      homeDomain,
      300,
      Networks.PUBLIC,
      webAuthDomain,
    );
    const transaction = TransactionBuilder.fromXDR(challenge, Networks.PUBLIC);
    transaction.sign(client);
    expect(() => verify(transaction.toEnvelope().toXDR("base64"), server, client)).toThrow();
  });

  it("rejects a nonzero sequence and a non-server transaction source", () => {
    const now = Date.now();
    const server = Keypair.random();
    const client = Keypair.random();
    expect(() =>
      verify(
        customChallenge({
          server,
          client,
          sequence: "0",
          timebounds: { minTime: Math.floor(now / 1000), maxTime: Math.floor(now / 1000) + 300 },
        }),
        server,
        client,
        now,
      ),
    ).toThrow();
    expect(() =>
      verify(
        customChallenge({
          server,
          client,
          source: Keypair.random(),
          timebounds: { minTime: Math.floor(now / 1000), maxTime: Math.floor(now / 1000) + 300 },
        }),
        server,
        client,
        now,
      ),
    ).toThrow();
  });

  it("rejects wrong domains and any missing, extra, or reordered operation", () => {
    const server = Keypair.random();
    const client = Keypair.random();
    const challenge = WebAuth.buildChallengeTx(
      server,
      client.publicKey(),
      homeDomain,
      300,
      Networks.TESTNET,
      webAuthDomain,
    );
    const signed = TransactionBuilder.fromXDR(challenge, Networks.TESTNET);
    signed.sign(client);
    const signedXdr = signed.toEnvelope().toXDR("base64").toString();
    expect(() =>
      verify(signedXdr, server, client, Date.now(), { homeDomain: "wrong.test" }),
    ).toThrow();
    expect(() =>
      verify(signedXdr, server, client, Date.now(), { webAuthDomain: "wrong.test" }),
    ).toThrow();

    const nowSeconds = Math.floor(Date.now() / 1000);
    const defaultOperations = operations(server, client);
    for (const challengeOperations of [
      [defaultOperations[0]!],
      [
        ...defaultOperations,
        Operation.manageData({ name: "unexpected", value: "1", source: server.publicKey() }),
      ],
      [defaultOperations[1]!, defaultOperations[0]!],
    ]) {
      expect(() =>
        verify(
          customChallenge({
            server,
            client,
            challengeOperations,
            timebounds: { minTime: nowSeconds, maxTime: nowSeconds + 300 },
          }),
          server,
          client,
        ),
      ).toThrow();
    }
  });

  it("enforces current, finite, five-minute time bounds without SDK grace", () => {
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    const server = Keypair.random();
    const client = Keypair.random();
    for (const timebounds of [
      { minTime: nowSeconds - 300, maxTime: nowSeconds },
      { minTime: nowSeconds + 1, maxTime: nowSeconds + 300 },
      { minTime: nowSeconds, maxTime: nowSeconds + 301 },
    ]) {
      expect(() =>
        verify(customChallenge({ server, client, timebounds }), server, client, now),
      ).toThrow();
    }
  });

  it("rejects missing, unknown, and insufficient client signatures", () => {
    const server = Keypair.random();
    const client = Keypair.random();
    const now = Date.now();
    const timebounds = {
      minTime: Math.floor(now / 1000),
      maxTime: Math.floor(now / 1000) + 300,
    };
    expect(() =>
      verify(
        customChallenge({ server, client, timebounds, clientSigners: [] }),
        server,
        client,
        now,
      ),
    ).toThrow();
    expect(() =>
      verify(
        customChallenge({ server, client, timebounds, clientSigners: [Keypair.random()] }),
        server,
        client,
        now,
      ),
    ).toThrow();
    expect(() =>
      verify(customChallenge({ server, client, timebounds }), server, client, now, {
        threshold: 2,
      }),
    ).toThrow();
  });

  it("rejects a challenge without the configured server signature", () => {
    const server = Keypair.random();
    const client = Keypair.random();
    const now = Date.now();
    expect(() =>
      verify(
        customChallenge({
          server,
          client,
          signServer: false,
          timebounds: {
            minTime: Math.floor(now / 1000),
            maxTime: Math.floor(now / 1000) + 300,
          },
        }),
        server,
        client,
        now,
      ),
    ).toThrow();
  });
});
