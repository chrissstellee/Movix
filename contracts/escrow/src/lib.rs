#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TtlConfig {
    pub threshold: u32,
    pub extend_to: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub treasury: Address,
    pub supported_sac_addresses: Vec<Address>,
    pub max_fee_bps: u32,
    pub ttl: TtlConfig,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Funded,
    Accepted,
    Shipped,
    RefundPending,
    Released,
    Refunded,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub schema_version: u32,
    pub id: BytesN<32>,
    pub buyer: Address,
    pub supplier: Address,
    pub token: Address,
    pub gross_amount: i128,
    pub fee_bps: u32,
    pub fee_amount: i128,
    pub status: Status,
    pub terms_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Escrow(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidConfig = 1,
    UnsupportedAsset = 2,
    InvalidAmount = 3,
    SameParty = 4,
    EscrowExists = 5,
    EscrowNotFound = 6,
    InvalidTransition = 7,
    ArithmeticFailure = 8,
}

#[contractevent]
pub struct Configured {
    #[topic]
    pub treasury: Address,
    pub supported_asset_count: u32,
    pub max_fee_bps: u32,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn __constructor(env: Env, config: Config) {
        if config.supported_sac_addresses.is_empty()
            || config.max_fee_bps > 10_000
            || config.ttl.threshold == 0
            || config.ttl.extend_to <= config.ttl.threshold
        {
            panic_with_error!(&env, Error::InvalidConfig);
        }

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage()
            .instance()
            .extend_ttl(config.ttl.threshold, config.ttl.extend_to);

        Configured {
            treasury: config.treasury.clone(),
            supported_asset_count: config.supported_sac_addresses.len(),
            max_fee_bps: config.max_fee_bps,
        }
        .publish(&env);
    }

    pub fn get_config(env: Env) -> Config {
        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidConfig));
        env.storage()
            .instance()
            .extend_ttl(config.ttl.threshold, config.ttl.extend_to);
        config
    }
}

#[cfg(test)]
mod test;
