#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, Vec,
};

pub const CONTRACT_VERSION: u32 = 1;
pub const ESCROW_SCHEMA_VERSION: u32 = 1;
pub const BPS_DENOMINATOR: i128 = 10_000;
pub const MAX_SUPPORTED_ASSETS: u32 = 2;

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

#[cfg_attr(target_family = "wasm", contracttype)]
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

#[cfg(not(target_family = "wasm"))]
mod status_test_support {
    extern crate std;

    use super::Status;
    use soroban_sdk::{
        testutils::arbitrary::SorobanArbitrary, xdr, ConversionError, Env, IntoVal, Symbol,
        TryFromVal, TryIntoVal, Val, Vec,
    };

    fn name(status: &Status) -> &'static str {
        match status {
            Status::Funded => "Funded",
            Status::Accepted => "Accepted",
            Status::Shipped => "Shipped",
            Status::RefundPending => "RefundPending",
            Status::Released => "Released",
            Status::Refunded => "Refunded",
            Status::Cancelled => "Cancelled",
        }
    }

    fn from_name(value: &str) -> Result<Status, ConversionError> {
        match value {
            "Funded" => Ok(Status::Funded),
            "Accepted" => Ok(Status::Accepted),
            "Shipped" => Ok(Status::Shipped),
            "RefundPending" => Ok(Status::RefundPending),
            "Released" => Ok(Status::Released),
            "Refunded" => Ok(Status::Refunded),
            "Cancelled" => Ok(Status::Cancelled),
            _ => Err(ConversionError),
        }
    }

    impl TryFromVal<Env, Val> for Status {
        type Error = ConversionError;

        fn try_from_val(env: &Env, value: &Val) -> Result<Self, Self::Error> {
            let values: Vec<Val> = value.try_into_val(env)?;
            let symbol: Symbol = values.first().ok_or(ConversionError)?.try_into_val(env)?;
            for candidate in [
                Status::Funded,
                Status::Accepted,
                Status::Shipped,
                Status::RefundPending,
                Status::Released,
                Status::Refunded,
                Status::Cancelled,
            ] {
                if symbol == Symbol::new(env, name(&candidate)) {
                    return Ok(candidate);
                }
            }
            Err(ConversionError)
        }
    }

    impl TryFromVal<Env, Status> for Val {
        type Error = ConversionError;

        fn try_from_val(env: &Env, value: &Status) -> Result<Self, Self::Error> {
            Ok((Symbol::new(env, name(value)),).into_val(env))
        }
    }

    impl TryFromVal<Env, &Status> for Val {
        type Error = ConversionError;

        fn try_from_val(env: &Env, value: &&Status) -> Result<Self, Self::Error> {
            Self::try_from_val(env, *value)
        }
    }

    impl From<Status> for xdr::ScVal {
        fn from(value: Status) -> Self {
            let symbol = xdr::ScVal::Symbol(xdr::ScSymbol(name(&value).try_into().unwrap()));
            let values: std::vec::Vec<xdr::ScVal> = std::vec![symbol];
            xdr::ScVal::Vec(Some(values.try_into().unwrap()))
        }
    }

    impl From<&Status> for xdr::ScVal {
        fn from(value: &Status) -> Self {
            value.clone().into()
        }
    }

    impl TryFromVal<Env, xdr::ScVal> for Status {
        type Error = xdr::Error;

        fn try_from_val(_env: &Env, value: &xdr::ScVal) -> Result<Self, Self::Error> {
            let xdr::ScVal::Vec(Some(values)) = value else {
                return Err(xdr::Error::Invalid);
            };
            let Some(xdr::ScVal::Symbol(symbol)) = values.first() else {
                return Err(xdr::Error::Invalid);
            };
            from_name(&symbol.to_utf8_string()?).map_err(|_| xdr::Error::Invalid)
        }
    }

    impl TryFromVal<Env, u32> for Status {
        type Error = ConversionError;

        fn try_from_val(_env: &Env, value: &u32) -> Result<Self, Self::Error> {
            match value % 7 {
                0 => Ok(Status::Funded),
                1 => Ok(Status::Accepted),
                2 => Ok(Status::Shipped),
                3 => Ok(Status::RefundPending),
                4 => Ok(Status::Released),
                5 => Ok(Status::Refunded),
                _ => Ok(Status::Cancelled),
            }
        }
    }

    impl SorobanArbitrary for Status {
        type Prototype = u32;
    }
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
    pub resume_status: Option<Status>,
    pub created_at: u64,
    pub accept_by: u64,
    pub terms_hash: BytesN<32>,
    pub shipment_hash: Option<BytesN<32>>,
    pub delivery_hash: Option<BytesN<32>>,
    pub refund_proposer: Option<Address>,
    pub refund_terms_hash: Option<BytesN<32>>,
    pub last_updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Escrow(BytesN<32>),
    Liability(Address),
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
    FeeTooHigh = 9,
    InvalidDeadline = 10,
    AcceptanceExpired = 11,
    CancellationTooEarly = 12,
    TermsMismatch = 13,
    UnauthorizedParty = 14,
    SamePartyApproval = 15,
    RefundTermsMismatch = 16,
    RefundProposerMismatch = 17,
    InvariantViolation = 18,
    InvalidHash = 19,
    NotInitialized = 20,
}

#[contractevent]
pub struct Configured {
    #[topic]
    pub treasury: Address,
    pub supported_asset_count: u32,
    pub max_fee_bps: u32,
    pub contract_version: u32,
}

#[contractevent]
pub struct Funded {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub buyer: Address,
    #[topic]
    pub supplier: Address,
    pub token: Address,
    pub gross_amount: i128,
    pub fee_bps: u32,
    pub fee_amount: i128,
    pub accept_by: u64,
    pub terms_hash: BytesN<32>,
    pub status: Status,
}

#[contractevent]
pub struct Accepted {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub supplier: Address,
    pub terms_hash: BytesN<32>,
    pub status: Status,
}

#[contractevent]
pub struct Shipped {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub supplier: Address,
    pub shipment_hash: BytesN<32>,
    pub status: Status,
}

#[contractevent]
pub struct Released {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub buyer: Address,
    #[topic]
    pub supplier: Address,
    pub treasury: Address,
    pub token: Address,
    pub gross_amount: i128,
    pub fee_amount: i128,
    pub net_amount: i128,
    pub delivery_hash: BytesN<32>,
    pub status: Status,
}

#[contractevent]
pub struct RefundProposed {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub proposer: Address,
    pub refund_terms_hash: BytesN<32>,
    pub resume_status: Status,
    pub status: Status,
}

#[contractevent]
pub struct RefundRejected {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub proposer: Address,
    #[topic]
    pub responder: Address,
    pub refund_terms_hash: BytesN<32>,
    pub restored_status: Status,
}

#[contractevent]
pub struct RefundWithdrawn {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub proposer: Address,
    pub refund_terms_hash: BytesN<32>,
    pub restored_status: Status,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub proposer: Address,
    #[topic]
    pub approver: Address,
    pub buyer: Address,
    pub token: Address,
    pub gross_amount: i128,
    pub refund_terms_hash: BytesN<32>,
    pub status: Status,
}

#[contractevent]
pub struct Cancelled {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub buyer: Address,
    pub token: Address,
    pub gross_amount: i128,
    pub accept_by: u64,
    pub status: Status,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn __constructor(env: Env, config: Config) {
        validate_config(&env, &config);
        env.storage().instance().set(&DataKey::Config, &config);
        extend_contract_ttl(&env, &config);

        Configured {
            treasury: config.treasury,
            supported_asset_count: config.supported_sac_addresses.len(),
            max_fee_bps: config.max_fee_bps,
            contract_version: CONTRACT_VERSION,
        }
        .publish(&env);
    }

    pub fn get_version(env: Env) -> u32 {
        let _ = load_config(&env);
        CONTRACT_VERSION
    }

    pub fn get_config(env: Env) -> Config {
        load_config(&env)
    }

    pub fn get_escrow(env: Env, id: BytesN<32>) -> Escrow {
        let config = load_config(&env);
        load_escrow(&env, &config, &id)
    }

    pub fn get_liability(env: Env, token: Address) -> i128 {
        let config = load_config(&env);
        require_supported_asset(&env, &config, &token);
        let key = DataKey::Liability(token);
        let liability = env.storage().persistent().get(&key).unwrap_or(0_i128);
        if env.storage().persistent().has(&key) {
            extend_persistent_ttl(&env, &config, &key);
        }
        liability
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_and_fund(
        env: Env,
        id: BytesN<32>,
        buyer: Address,
        supplier: Address,
        token: Address,
        amount: i128,
        fee_bps: u32,
        accept_by: u64,
        terms_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let escrow_key = DataKey::Escrow(id.clone());
        if env.storage().persistent().has(&escrow_key) {
            panic_with_error!(&env, Error::EscrowExists);
        }
        if buyer == supplier {
            panic_with_error!(&env, Error::SameParty);
        }
        require_supported_asset(&env, &config, &token);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if fee_bps > config.max_fee_bps {
            panic_with_error!(&env, Error::FeeTooHigh);
        }
        let now = env.ledger().timestamp();
        if accept_by <= now {
            panic_with_error!(&env, Error::InvalidDeadline);
        }
        require_nonzero_hash(&env, &terms_hash);
        let fee_amount = calculate_fee(&env, amount, fee_bps);
        let _net_amount = amount
            .checked_sub(fee_amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticFailure));

        buyer.require_auth();
        let contract = env.current_contract_address();
        token::TokenClient::new(&env, &token).transfer(&buyer, &contract, &amount);

        let liability = read_liability(&env, &token);
        let next_liability = liability
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticFailure));

        let escrow = Escrow {
            schema_version: ESCROW_SCHEMA_VERSION,
            id: id.clone(),
            buyer: buyer.clone(),
            supplier: supplier.clone(),
            token: token.clone(),
            gross_amount: amount,
            fee_bps,
            fee_amount,
            status: Status::Funded,
            resume_status: None,
            created_at: now,
            accept_by,
            terms_hash: terms_hash.clone(),
            shipment_hash: None,
            delivery_hash: None,
            refund_proposer: None,
            refund_terms_hash: None,
            last_updated_at: now,
        };

        write_liability(&env, &config, &token, next_liability);
        store_escrow(&env, &config, &escrow);
        require_solvency(&env, &token, next_liability);

        Funded {
            id,
            buyer,
            supplier,
            token,
            gross_amount: amount,
            fee_bps,
            fee_amount,
            accept_by,
            terms_hash,
            status: Status::Funded,
        }
        .publish(&env);
        escrow
    }

    pub fn accept(env: Env, id: BytesN<32>, supplier: Address, terms_hash: BytesN<32>) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        if escrow.status != Status::Funded {
            panic_with_error!(&env, Error::InvalidTransition);
        }
        if env.ledger().timestamp() >= escrow.accept_by {
            panic_with_error!(&env, Error::AcceptanceExpired);
        }
        require_party(&env, &supplier, &escrow.supplier);
        if terms_hash != escrow.terms_hash {
            panic_with_error!(&env, Error::TermsMismatch);
        }
        supplier.require_auth();

        escrow.status = Status::Accepted;
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);
        Accepted {
            id,
            supplier,
            terms_hash,
            status: Status::Accepted,
        }
        .publish(&env);
        escrow
    }

    pub fn mark_shipped(
        env: Env,
        id: BytesN<32>,
        supplier: Address,
        shipment_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        if escrow.status != Status::Accepted {
            panic_with_error!(&env, Error::InvalidTransition);
        }
        require_party(&env, &supplier, &escrow.supplier);
        require_nonzero_hash(&env, &shipment_hash);
        supplier.require_auth();

        escrow.shipment_hash = Some(shipment_hash.clone());
        escrow.status = Status::Shipped;
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);
        Shipped {
            id,
            supplier,
            shipment_hash,
            status: Status::Shipped,
        }
        .publish(&env);
        escrow
    }

    pub fn confirm_delivery(
        env: Env,
        id: BytesN<32>,
        buyer: Address,
        delivery_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        if escrow.status != Status::Shipped {
            panic_with_error!(&env, Error::InvalidTransition);
        }
        require_party(&env, &buyer, &escrow.buyer);
        require_nonzero_hash(&env, &delivery_hash);
        buyer.require_auth();

        let net_amount = validate_payout(&env, &escrow);
        let liability = read_liability(&env, &escrow.token);
        let next_liability = decrease_liability(&env, liability, escrow.gross_amount);
        let contract = env.current_contract_address();
        let token_client = token::TokenClient::new(&env, &escrow.token);
        token_client.transfer(&contract, &escrow.supplier, &net_amount);
        if escrow.fee_amount > 0 {
            token_client.transfer(&contract, &config.treasury, &escrow.fee_amount);
        }

        write_liability(&env, &config, &escrow.token, next_liability);
        require_solvency(&env, &escrow.token, next_liability);
        escrow.delivery_hash = Some(delivery_hash.clone());
        escrow.status = Status::Released;
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);

        Released {
            id,
            buyer,
            supplier: escrow.supplier.clone(),
            treasury: config.treasury,
            token: escrow.token.clone(),
            gross_amount: escrow.gross_amount,
            fee_amount: escrow.fee_amount,
            net_amount,
            delivery_hash,
            status: Status::Released,
        }
        .publish(&env);
        escrow
    }

    pub fn propose_refund(
        env: Env,
        id: BytesN<32>,
        proposer: Address,
        refund_terms_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        let resume_status = match escrow.status {
            Status::Funded | Status::Accepted | Status::Shipped => escrow.status.clone(),
            _ => panic_with_error!(&env, Error::InvalidTransition),
        };
        require_participant(&env, &proposer, &escrow);
        require_nonzero_hash(&env, &refund_terms_hash);
        proposer.require_auth();

        escrow.resume_status = Some(resume_status.clone());
        escrow.refund_proposer = Some(proposer.clone());
        escrow.refund_terms_hash = Some(refund_terms_hash.clone());
        escrow.status = Status::RefundPending;
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);

        RefundProposed {
            id,
            proposer,
            refund_terms_hash,
            resume_status,
            status: Status::RefundPending,
        }
        .publish(&env);
        escrow
    }

    pub fn approve_refund(
        env: Env,
        id: BytesN<32>,
        approver: Address,
        refund_terms_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        require_refund_pending(&env, &escrow);
        require_participant(&env, &approver, &escrow);
        let proposer = refund_proposer(&env, &escrow);
        if approver == proposer {
            panic_with_error!(&env, Error::SamePartyApproval);
        }
        require_refund_hash(&env, &escrow, &refund_terms_hash);
        approver.require_auth();

        let liability = read_liability(&env, &escrow.token);
        let next_liability = decrease_liability(&env, liability, escrow.gross_amount);
        let contract = env.current_contract_address();
        token::TokenClient::new(&env, &escrow.token).transfer(
            &contract,
            &escrow.buyer,
            &escrow.gross_amount,
        );
        write_liability(&env, &config, &escrow.token, next_liability);
        require_solvency(&env, &escrow.token, next_liability);

        escrow.resume_status = None;
        escrow.status = Status::Refunded;
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);

        Refunded {
            id,
            proposer,
            approver,
            buyer: escrow.buyer.clone(),
            token: escrow.token.clone(),
            gross_amount: escrow.gross_amount,
            refund_terms_hash,
            status: Status::Refunded,
        }
        .publish(&env);
        escrow
    }

    pub fn reject_refund(
        env: Env,
        id: BytesN<32>,
        approver: Address,
        refund_terms_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        require_refund_pending(&env, &escrow);
        require_participant(&env, &approver, &escrow);
        let proposer = refund_proposer(&env, &escrow);
        if approver == proposer {
            panic_with_error!(&env, Error::SamePartyApproval);
        }
        require_refund_hash(&env, &escrow, &refund_terms_hash);
        approver.require_auth();
        let restored_status = refund_resume_status(&env, &escrow);

        clear_pending_refund(&mut escrow, restored_status.clone());
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);
        RefundRejected {
            id,
            proposer,
            responder: approver,
            refund_terms_hash,
            restored_status,
        }
        .publish(&env);
        escrow
    }

    pub fn withdraw_refund(
        env: Env,
        id: BytesN<32>,
        proposer: Address,
        refund_terms_hash: BytesN<32>,
    ) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        require_refund_pending(&env, &escrow);
        let recorded_proposer = refund_proposer(&env, &escrow);
        if proposer != recorded_proposer {
            panic_with_error!(&env, Error::RefundProposerMismatch);
        }
        require_refund_hash(&env, &escrow, &refund_terms_hash);
        proposer.require_auth();
        let restored_status = refund_resume_status(&env, &escrow);

        clear_pending_refund(&mut escrow, restored_status.clone());
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);
        RefundWithdrawn {
            id,
            proposer,
            refund_terms_hash,
            restored_status,
        }
        .publish(&env);
        escrow
    }

    pub fn cancel_unaccepted(env: Env, id: BytesN<32>, buyer: Address) -> Escrow {
        let config = load_config(&env);
        let mut escrow = load_escrow(&env, &config, &id);
        if escrow.status != Status::Funded {
            panic_with_error!(&env, Error::InvalidTransition);
        }
        require_party(&env, &buyer, &escrow.buyer);
        if env.ledger().timestamp() < escrow.accept_by {
            panic_with_error!(&env, Error::CancellationTooEarly);
        }
        buyer.require_auth();

        let liability = read_liability(&env, &escrow.token);
        let next_liability = decrease_liability(&env, liability, escrow.gross_amount);
        let contract = env.current_contract_address();
        token::TokenClient::new(&env, &escrow.token).transfer(
            &contract,
            &escrow.buyer,
            &escrow.gross_amount,
        );
        write_liability(&env, &config, &escrow.token, next_liability);
        require_solvency(&env, &escrow.token, next_liability);
        escrow.status = Status::Cancelled;
        escrow.last_updated_at = env.ledger().timestamp();
        store_escrow(&env, &config, &escrow);

        Cancelled {
            id,
            buyer,
            token: escrow.token.clone(),
            gross_amount: escrow.gross_amount,
            accept_by: escrow.accept_by,
            status: Status::Cancelled,
        }
        .publish(&env);
        escrow
    }
}

fn validate_config(env: &Env, config: &Config) {
    let asset_count = config.supported_sac_addresses.len();
    if config.treasury == env.current_contract_address()
        || asset_count == 0
        || asset_count > MAX_SUPPORTED_ASSETS
        || config.max_fee_bps > BPS_DENOMINATOR as u32
        || config.ttl.threshold == 0
        || config.ttl.extend_to <= config.ttl.threshold
        || config.ttl.extend_to > env.storage().max_ttl()
    {
        panic_with_error!(env, Error::InvalidConfig);
    }

    for left in 0..asset_count {
        for right in (left + 1)..asset_count {
            if config.supported_sac_addresses.get(left) == config.supported_sac_addresses.get(right)
            {
                panic_with_error!(env, Error::InvalidConfig);
            }
        }
    }
}

fn load_config(env: &Env) -> Config {
    let config = env
        .storage()
        .instance()
        .get(&DataKey::Config)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
    extend_contract_ttl(env, &config);
    config
}

fn extend_contract_ttl(env: &Env, config: &Config) {
    env.storage()
        .instance()
        .extend_ttl(config.ttl.threshold, config.ttl.extend_to);
    env.deployer().extend_ttl(
        env.current_contract_address(),
        config.ttl.threshold,
        config.ttl.extend_to,
    );
}

fn extend_persistent_ttl(env: &Env, config: &Config, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, config.ttl.threshold, config.ttl.extend_to);
}

fn require_supported_asset(env: &Env, config: &Config, token: &Address) {
    for supported in config.supported_sac_addresses.iter() {
        if supported == *token {
            return;
        }
    }
    panic_with_error!(env, Error::UnsupportedAsset);
}

fn require_nonzero_hash(env: &Env, hash: &BytesN<32>) {
    if *hash == BytesN::from_array(env, &[0; 32]) {
        panic_with_error!(env, Error::InvalidHash);
    }
}

fn require_party(env: &Env, actor: &Address, required: &Address) {
    if actor != required {
        panic_with_error!(env, Error::UnauthorizedParty);
    }
}

fn require_participant(env: &Env, actor: &Address, escrow: &Escrow) {
    if *actor != escrow.buyer && *actor != escrow.supplier {
        panic_with_error!(env, Error::UnauthorizedParty);
    }
}

fn load_escrow(env: &Env, config: &Config, id: &BytesN<32>) -> Escrow {
    let key = DataKey::Escrow(id.clone());
    let escrow = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, Error::EscrowNotFound));
    extend_persistent_ttl(env, config, &key);
    escrow
}

fn store_escrow(env: &Env, config: &Config, escrow: &Escrow) {
    let key = DataKey::Escrow(escrow.id.clone());
    env.storage().persistent().set(&key, escrow);
    extend_persistent_ttl(env, config, &key);
}

fn read_liability(env: &Env, token: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Liability(token.clone()))
        .unwrap_or(0)
}

fn write_liability(env: &Env, config: &Config, token: &Address, liability: i128) {
    if liability < 0 {
        panic_with_error!(env, Error::InvariantViolation);
    }
    let key = DataKey::Liability(token.clone());
    env.storage().persistent().set(&key, &liability);
    extend_persistent_ttl(env, config, &key);
}

fn decrease_liability(env: &Env, current: i128, amount: i128) -> i128 {
    let next = current
        .checked_sub(amount)
        .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticFailure));
    if next < 0 {
        panic_with_error!(env, Error::InvariantViolation);
    }
    next
}

fn calculate_fee(env: &Env, amount: i128, fee_bps: u32) -> i128 {
    amount
        .checked_mul(i128::from(fee_bps))
        .and_then(|value| value.checked_div(BPS_DENOMINATOR))
        .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticFailure))
}

fn validate_payout(env: &Env, escrow: &Escrow) -> i128 {
    if escrow.gross_amount <= 0
        || escrow.fee_bps > BPS_DENOMINATOR as u32
        || escrow.fee_amount < 0
        || calculate_fee(env, escrow.gross_amount, escrow.fee_bps) != escrow.fee_amount
    {
        panic_with_error!(env, Error::InvariantViolation);
    }
    let net = escrow
        .gross_amount
        .checked_sub(escrow.fee_amount)
        .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticFailure));
    if net < 0
        || net
            .checked_add(escrow.fee_amount)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticFailure))
            != escrow.gross_amount
    {
        panic_with_error!(env, Error::InvariantViolation);
    }
    net
}

fn require_solvency(env: &Env, token: &Address, liability: i128) {
    let balance = token::TokenClient::new(env, token).balance(&env.current_contract_address());
    if balance < liability {
        panic_with_error!(env, Error::InvariantViolation);
    }
}

fn require_refund_pending(env: &Env, escrow: &Escrow) {
    if escrow.status != Status::RefundPending {
        panic_with_error!(env, Error::InvalidTransition);
    }
}

fn refund_proposer(env: &Env, escrow: &Escrow) -> Address {
    escrow
        .refund_proposer
        .clone()
        .unwrap_or_else(|| panic_with_error!(env, Error::InvariantViolation))
}

fn require_refund_hash(env: &Env, escrow: &Escrow, supplied: &BytesN<32>) {
    let recorded = escrow
        .refund_terms_hash
        .clone()
        .unwrap_or_else(|| panic_with_error!(env, Error::InvariantViolation));
    if recorded != *supplied {
        panic_with_error!(env, Error::RefundTermsMismatch);
    }
}

fn refund_resume_status(env: &Env, escrow: &Escrow) -> Status {
    match escrow.resume_status.clone() {
        Some(Status::Funded) => Status::Funded,
        Some(Status::Accepted) => Status::Accepted,
        Some(Status::Shipped) => Status::Shipped,
        _ => panic_with_error!(env, Error::InvariantViolation),
    }
}

fn clear_pending_refund(escrow: &mut Escrow, restored_status: Status) {
    escrow.status = restored_status;
    escrow.resume_status = None;
    escrow.refund_proposer = None;
    escrow.refund_terms_hash = None;
}

#[cfg(test)]
mod test;
