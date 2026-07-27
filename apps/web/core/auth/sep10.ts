import { WebAuth } from "@stellar/stellar-sdk";

interface VerifySep10Input {
  signedTransactionXdr: string;
  serverAccount: string;
  networkPassphrase: string;
  homeDomain: string;
  webAuthDomain: string;
  challengeSeconds: number;
  now: number;
  threshold: number;
  signers: Parameters<typeof WebAuth.verifyChallengeTxThreshold>[4];
}

function invalidChallenge(): never {
  throw new Error("INVALID_SEP10_CHALLENGE");
}

export function readSep10Challenge(
  signedTransactionXdr: string,
  serverAccount: string,
  networkPassphrase: string,
  homeDomain: string,
  webAuthDomain: string,
) {
  const challenge = WebAuth.readChallengeTx(
    signedTransactionXdr,
    serverAccount,
    networkPassphrase,
    homeDomain,
    webAuthDomain,
  );
  const [authOperation, domainOperation] = challenge.tx.operations;
  if (
    challenge.tx.operations.length !== 2 ||
    authOperation?.type !== "manageData" ||
    authOperation.source !== challenge.clientAccountID ||
    authOperation.name !== `${homeDomain} auth` ||
    domainOperation?.type !== "manageData" ||
    domainOperation.source !== serverAccount ||
    domainOperation.name !== "web_auth_domain" ||
    !domainOperation.value ||
    domainOperation.value.toString() !== webAuthDomain
  ) {
    invalidChallenge();
  }
  return challenge;
}

export function verifySep10Challenge(input: VerifySep10Input) {
  const challenge = readSep10Challenge(
    input.signedTransactionXdr,
    input.serverAccount,
    input.networkPassphrase,
    input.homeDomain,
    input.webAuthDomain,
  );
  const bounds = challenge.tx.timeBounds;
  const nowSeconds = Math.floor(input.now / 1000);
  if (!bounds) {
    invalidChallenge();
  }
  const minTime = Number(bounds.minTime);
  const maxTime = Number(bounds.maxTime);
  if (
    !Number.isSafeInteger(minTime) ||
    !Number.isSafeInteger(maxTime) ||
    minTime > nowSeconds ||
    maxTime <= nowSeconds ||
    maxTime - minTime > input.challengeSeconds
  ) {
    invalidChallenge();
  }

  WebAuth.verifyChallengeTxThreshold(
    input.signedTransactionXdr,
    input.serverAccount,
    input.networkPassphrase,
    input.threshold,
    input.signers,
    input.homeDomain,
    input.webAuthDomain,
  );

  return challenge;
}
