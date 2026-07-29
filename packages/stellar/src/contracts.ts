import { Networks, StrKey } from "@stellar/stellar-sdk";

import {
  Client as GeneratedEscrowClient,
  type Config,
  type Escrow,
  type Status,
  type TtlConfig,
} from "../generated/escrow/src/index.js";

import { TESTNET_USDC_CONTRACT, TESTNET_XLM_CONTRACT, testnetConfig } from "./config.js";

import type { MethodOptions } from "@stellar/stellar-sdk/contract";

export type { Config as EscrowConfig, Escrow, Status as GeneratedEscrowStatus, TtlConfig };
export { Errors as EscrowGeneratedErrors } from "../generated/escrow/src/index.js";

type GeneratedClientOptions = ConstructorParameters<typeof GeneratedEscrowClient>[0];
type ClientMethod = (...args: never[]) => Promise<unknown>;
type MethodArgs<T extends ClientMethod> = Parameters<T>[0];
type MethodResult<T extends ClientMethod> = ReturnType<T>;

export interface TestnetEscrowClientOptions extends Omit<
  GeneratedClientOptions,
  "contractId" | "networkPassphrase" | "rpcUrl"
> {
  contractId: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  supportedAssets?: readonly string[];
}

/**
 * Thin, typed adapter over the generated escrow client.
 *
 * The adapter intentionally contains no generic method dispatcher. ABI changes
 * must first regenerate `generated/escrow` from the optimized release WASM.
 */
export class EscrowContractClient {
  constructor(readonly generated: GeneratedEscrowClient) {}

  async getVersion(options?: MethodOptions): Promise<number> {
    return (await this.generated.get_version(options)).result;
  }

  async getConfig(options?: MethodOptions): Promise<Config> {
    return (await this.generated.get_config(options)).result;
  }

  async getEscrow(
    args: MethodArgs<GeneratedEscrowClient["get_escrow"]>,
    options?: MethodOptions,
  ): Promise<Escrow> {
    return (await this.generated.get_escrow(args, options)).result;
  }

  async getLiability(
    args: MethodArgs<GeneratedEscrowClient["get_liability"]>,
    options?: MethodOptions,
  ): Promise<bigint> {
    return (await this.generated.get_liability(args, options)).result;
  }

  createAndFund(
    args: MethodArgs<GeneratedEscrowClient["create_and_fund"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["create_and_fund"]> {
    return this.generated.create_and_fund(args, options);
  }

  accept(
    args: MethodArgs<GeneratedEscrowClient["accept"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["accept"]> {
    return this.generated.accept(args, options);
  }

  /**
   * Agricultural application name for the unchanged escrow-v1 `accept` method.
   * This acknowledges a funded escrow; it is not off-chain Trade Agreement acceptance.
   */
  activateEscrow(
    args: MethodArgs<GeneratedEscrowClient["accept"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["accept"]> {
    return this.generated.accept(args, options);
  }

  markShipped(
    args: MethodArgs<GeneratedEscrowClient["mark_shipped"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["mark_shipped"]> {
    return this.generated.mark_shipped(args, options);
  }

  confirmDelivery(
    args: MethodArgs<GeneratedEscrowClient["confirm_delivery"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["confirm_delivery"]> {
    return this.generated.confirm_delivery(args, options);
  }

  proposeRefund(
    args: MethodArgs<GeneratedEscrowClient["propose_refund"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["propose_refund"]> {
    return this.generated.propose_refund(args, options);
  }

  approveRefund(
    args: MethodArgs<GeneratedEscrowClient["approve_refund"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["approve_refund"]> {
    return this.generated.approve_refund(args, options);
  }

  rejectRefund(
    args: MethodArgs<GeneratedEscrowClient["reject_refund"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["reject_refund"]> {
    return this.generated.reject_refund(args, options);
  }

  withdrawRefund(
    args: MethodArgs<GeneratedEscrowClient["withdraw_refund"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["withdraw_refund"]> {
    return this.generated.withdraw_refund(args, options);
  }

  cancelUnaccepted(
    args: MethodArgs<GeneratedEscrowClient["cancel_unaccepted"]>,
    options?: MethodOptions,
  ): MethodResult<GeneratedEscrowClient["cancel_unaccepted"]> {
    return this.generated.cancel_unaccepted(args, options);
  }
}

export function createTestnetEscrowClient(
  options: TestnetEscrowClientOptions,
): EscrowContractClient {
  if (!StrKey.isValidContract(options.contractId)) {
    throw new Error("Escrow contract ID must be a valid Stellar contract address");
  }

  const networkPassphrase = options.networkPassphrase ?? Networks.TESTNET;
  if (networkPassphrase !== Networks.TESTNET) {
    throw new Error("Escrow client accepts Stellar testnet only");
  }

  const rpcUrl = options.rpcUrl ?? testnetConfig.rpcUrl;
  assertHttpsUrl(rpcUrl);

  const supportedAssets = options.supportedAssets ?? [TESTNET_XLM_CONTRACT, TESTNET_USDC_CONTRACT];
  assertApprovedAssets(supportedAssets);

  const { supportedAssets: _supportedAssets, ...clientOptions } = options;
  return new EscrowContractClient(
    new GeneratedEscrowClient({
      ...clientOptions,
      contractId: options.contractId,
      networkPassphrase,
      rpcUrl,
    }),
  );
}

function assertApprovedAssets(assets: readonly string[]): void {
  const approved = new Set([TESTNET_XLM_CONTRACT, TESTNET_USDC_CONTRACT]);
  if (
    assets.length === 0 ||
    assets.length > 2 ||
    new Set(assets).size !== assets.length ||
    assets.some((asset) => !StrKey.isValidContract(asset) || !approved.has(asset))
  ) {
    throw new Error("Escrow client assets must be one or two unique approved testnet SACs");
  }
}

function assertHttpsUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Escrow RPC URL must be valid");
  }
  if (url.protocol !== "https:") {
    throw new Error("Escrow RPC URL must use HTTPS");
  }
}
