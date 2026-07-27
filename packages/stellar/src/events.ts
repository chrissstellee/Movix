export interface NormalizedContractEvent<T = unknown> {
  contractId: string;
  ledger: number;
  transactionHash: string;
  type: string;
  payload: T;
}

export interface ContractEventDecoder<T = unknown> {
  decode(event: unknown): NormalizedContractEvent<T>;
}
