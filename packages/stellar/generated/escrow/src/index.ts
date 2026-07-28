import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidConfig"},
  2: {message:"UnsupportedAsset"},
  3: {message:"InvalidAmount"},
  4: {message:"SameParty"},
  5: {message:"EscrowExists"},
  6: {message:"EscrowNotFound"},
  7: {message:"InvalidTransition"},
  8: {message:"ArithmeticFailure"},
  9: {message:"FeeTooHigh"},
  10: {message:"InvalidDeadline"},
  11: {message:"AcceptanceExpired"},
  12: {message:"CancellationTooEarly"},
  13: {message:"TermsMismatch"},
  14: {message:"UnauthorizedParty"},
  15: {message:"SamePartyApproval"},
  16: {message:"RefundTermsMismatch"},
  17: {message:"RefundProposerMismatch"},
  18: {message:"InvariantViolation"},
  19: {message:"InvalidHash"},
  20: {message:"NotInitialized"}
}


export interface Config {
  max_fee_bps: u32;
  supported_sac_addresses: Array<string>;
  treasury: string;
  ttl: TtlConfig;
}


export interface Escrow {
  accept_by: u64;
  buyer: string;
  created_at: u64;
  delivery_hash: Option<Buffer>;
  fee_amount: i128;
  fee_bps: u32;
  gross_amount: i128;
  id: Buffer;
  last_updated_at: u64;
  refund_proposer: Option<string>;
  refund_terms_hash: Option<Buffer>;
  resume_status: Option<Status>;
  schema_version: u32;
  shipment_hash: Option<Buffer>;
  status: Status;
  supplier: string;
  terms_hash: Buffer;
  token: string;
}

export type Status = {tag: "Funded", values: void} | {tag: "Accepted", values: void} | {tag: "Shipped", values: void} | {tag: "RefundPending", values: void} | {tag: "Released", values: void} | {tag: "Refunded", values: void} | {tag: "Cancelled", values: void};


export type DataKey = {tag: "Config", values: void} | {tag: "Escrow", values: readonly [Buffer]} | {tag: "Liability", values: readonly [string]};






export interface TtlConfig {
  extend_to: u32;
  threshold: u32;
}






export interface Client {
  /**
   * Construct and simulate a accept transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  accept: ({id, supplier, terms_hash}: {id: Buffer, supplier: string, terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: ({id}: {id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a get_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a mark_shipped transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mark_shipped: ({id, supplier, shipment_hash}: {id: Buffer, supplier: string, shipment_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a get_liability transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_liability: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a reject_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reject_refund: ({id, approver, refund_terms_hash}: {id: Buffer, approver: string, refund_terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a approve_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_refund: ({id, approver, refund_terms_hash}: {id: Buffer, approver: string, refund_terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a propose_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  propose_refund: ({id, proposer, refund_terms_hash}: {id: Buffer, proposer: string, refund_terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a create_and_fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_and_fund: ({id, buyer, supplier, token, amount, fee_bps, accept_by, terms_hash}: {id: Buffer, buyer: string, supplier: string, token: string, amount: i128, fee_bps: u32, accept_by: u64, terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a withdraw_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw_refund: ({id, proposer, refund_terms_hash}: {id: Buffer, proposer: string, refund_terms_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a confirm_delivery transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  confirm_delivery: ({id, buyer, delivery_hash}: {id: Buffer, buyer: string, delivery_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a cancel_unaccepted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_unaccepted: ({id, buyer}: {id: Buffer, buyer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {config}: {config: Config},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({config}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAFAAAAAAAAAANSW52YWxpZENvbmZpZwAAAAAAAAEAAAAAAAAAEFVuc3VwcG9ydGVkQXNzZXQAAAACAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAAAwAAAAAAAAAJU2FtZVBhcnR5AAAAAAAABAAAAAAAAAAMRXNjcm93RXhpc3RzAAAABQAAAAAAAAAORXNjcm93Tm90Rm91bmQAAAAAAAYAAAAAAAAAEUludmFsaWRUcmFuc2l0aW9uAAAAAAAABwAAAAAAAAARQXJpdGhtZXRpY0ZhaWx1cmUAAAAAAAAIAAAAAAAAAApGZWVUb29IaWdoAAAAAAAJAAAAAAAAAA9JbnZhbGlkRGVhZGxpbmUAAAAACgAAAAAAAAARQWNjZXB0YW5jZUV4cGlyZWQAAAAAAAALAAAAAAAAABRDYW5jZWxsYXRpb25Ub29FYXJseQAAAAwAAAAAAAAADVRlcm1zTWlzbWF0Y2gAAAAAAAANAAAAAAAAABFVbmF1dGhvcml6ZWRQYXJ0eQAAAAAAAA4AAAAAAAAAEVNhbWVQYXJ0eUFwcHJvdmFsAAAAAAAADwAAAAAAAAATUmVmdW5kVGVybXNNaXNtYXRjaAAAAAAQAAAAAAAAABZSZWZ1bmRQcm9wb3Nlck1pc21hdGNoAAAAAAARAAAAAAAAABJJbnZhcmlhbnRWaW9sYXRpb24AAAAAABIAAAAAAAAAC0ludmFsaWRIYXNoAAAAABMAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAAU",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAABAAAAAAAAAALbWF4X2ZlZV9icHMAAAAABAAAAAAAAAAXc3VwcG9ydGVkX3NhY19hZGRyZXNzZXMAAAAD6gAAABMAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAAAAAADdHRsAAAAB9AAAAAJVHRsQ29uZmlnAAAA",
        "AAAAAQAAAAAAAAAAAAAABkVzY3JvdwAAAAAAEgAAAAAAAAAJYWNjZXB0X2J5AAAAAAAABgAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAA1kZWxpdmVyeV9oYXNoAAAAAAAD6AAAA+4AAAAgAAAAAAAAAApmZWVfYW1vdW50AAAAAAALAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAADGdyb3NzX2Ftb3VudAAAAAsAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAPbGFzdF91cGRhdGVkX2F0AAAAAAYAAAAAAAAAD3JlZnVuZF9wcm9wb3NlcgAAAAPoAAAAEwAAAAAAAAARcmVmdW5kX3Rlcm1zX2hhc2gAAAAAAAPoAAAD7gAAACAAAAAAAAAADXJlc3VtZV9zdGF0dXMAAAAAAAPoAAAH0AAAAAZTdGF0dXMAAAAAAAAAAAAOc2NoZW1hX3ZlcnNpb24AAAAAAAQAAAAAAAAADXNoaXBtZW50X2hhc2gAAAAAAAPoAAAD7gAAACAAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAAAAAAAAAAAIc3VwcGxpZXIAAAATAAAAAAAAAAp0ZXJtc19oYXNoAAAAAAPuAAAAIAAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "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",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAACaWQAAAAAA+4AAAAgAAAAAQAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAALZ2V0X3ZlcnNpb24AAAAAAAAAAAEAAAAE",
        "AAAAAAAAAAAAAAAMbWFya19zaGlwcGVkAAAAAwAAAAAAAAACaWQAAAAAA+4AAAAgAAAAAAAAAAhzdXBwbGllcgAAABMAAAAAAAAADXNoaXBtZW50X2hhc2gAAAAAAAPuAAAAIAAAAAEAAAfQAAAABkVzY3JvdwAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABmNvbmZpZwAAAAAH0AAAAAZDb25maWcAAAAAAAA=",
        "AAAAAAAAAAAAAAANZ2V0X2xpYWJpbGl0eQAAAAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAANcmVqZWN0X3JlZnVuZAAAAAAAAAMAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAABFyZWZ1bmRfdGVybXNfaGFzaAAAAAAAA+4AAAAgAAAAAQAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAOYXBwcm92ZV9yZWZ1bmQAAAAAAAMAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAABFyZWZ1bmRfdGVybXNfaGFzaAAAAAAAA+4AAAAgAAAAAQAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAOcHJvcG9zZV9yZWZ1bmQAAAAAAAMAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAIcHJvcG9zZXIAAAATAAAAAAAAABFyZWZ1bmRfdGVybXNfaGFzaAAAAAAAA+4AAAAgAAAAAQAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAPY3JlYXRlX2FuZF9mdW5kAAAAAAgAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAhzdXBwbGllcgAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAACWFjY2VwdF9ieQAAAAAAAAYAAAAAAAAACnRlcm1zX2hhc2gAAAAAA+4AAAAgAAAAAQAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAPd2l0aGRyYXdfcmVmdW5kAAAAAAMAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAIcHJvcG9zZXIAAAATAAAAAAAAABFyZWZ1bmRfdGVybXNfaGFzaAAAAAAAA+4AAAAgAAAAAQAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAQY29uZmlybV9kZWxpdmVyeQAAAAMAAAAAAAAAAmlkAAAAAAPuAAAAIAAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAA1kZWxpdmVyeV9oYXNoAAAAAAAD7gAAACAAAAABAAAH0AAAAAZFc2Nyb3cAAA==",
        "AAAAAAAAAAAAAAARY2FuY2VsX3VuYWNjZXB0ZWQAAAAAAAACAAAAAAAAAAJpZAAAAAAD7gAAACAAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAEAAAfQAAAABkVzY3JvdwAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    accept: this.txFromJSON<Escrow>,
        get_config: this.txFromJSON<Config>,
        get_escrow: this.txFromJSON<Escrow>,
        get_version: this.txFromJSON<u32>,
        mark_shipped: this.txFromJSON<Escrow>,
        get_liability: this.txFromJSON<i128>,
        reject_refund: this.txFromJSON<Escrow>,
        approve_refund: this.txFromJSON<Escrow>,
        propose_refund: this.txFromJSON<Escrow>,
        create_and_fund: this.txFromJSON<Escrow>,
        withdraw_refund: this.txFromJSON<Escrow>,
        confirm_delivery: this.txFromJSON<Escrow>,
        cancel_unaccepted: this.txFromJSON<Escrow>
  }
}