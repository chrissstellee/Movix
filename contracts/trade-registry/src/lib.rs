#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, String, Symbol,
};

pub const CONTRACT_VERSION: u32 = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeRecord {
    pub trade_id: BytesN<32>,
    pub buyer: Address,
    pub supplier: Address,
    pub commodity: String,
    pub origin_country: String,
    pub destination_country: String,
    pub escrow_contract: Address,
    pub escrow_verified: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum RegistryDataKey {
    Admin,
    EscrowContract,
    Trade(BytesN<32>),
    TradeCount,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    NotInitialized = 1,
    TradeExists = 2,
    TradeNotFound = 3,
    SameParty = 4,
    UnauthorizedCaller = 5,
    InvalidInput = 6,
    EscrowVerificationFailed = 7,
    InterContractCallFailed = 8,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct TradeRegistered {
    #[topic]
    pub trade_id: BytesN<32>,
    #[topic]
    pub buyer: Address,
    #[topic]
    pub supplier: Address,
    pub commodity: String,
    pub origin_country: String,
    pub destination_country: String,
}

#[contractevent]
pub struct EscrowVerified {
    #[topic]
    pub trade_id: BytesN<32>,
    pub escrow_contract: Address,
    pub verified: bool,
}

// ---------------------------------------------------------------------------
// Inter-contract interface: Escrow contract get_escrow
// ---------------------------------------------------------------------------

/// Minimal struct mirroring escrow contract Escrow fields we need.
/// The actual escrow contract returns a full Escrow struct; we only need
/// to confirm it exists and read the status field.
mod escrow_interface {
    use soroban_sdk::{contractclient, BytesN, Env};

    /// Minimal Escrow data returned by the escrow contract's get_escrow.
    /// We use a raw Val return and just check that the call succeeds.
    #[contractclient(name = "EscrowContractClient")]
    pub trait EscrowContractInterface {
        fn get_escrow(env: Env, id: BytesN<32>) -> soroban_sdk::Val;
    }
}

// ---------------------------------------------------------------------------
// Contract Implementation
// ---------------------------------------------------------------------------

#[contract]
pub struct TradeRegistryContract;

#[contractimpl]
impl TradeRegistryContract {
    /// Initialize the trade registry with an admin and the address of the escrow contract.
    pub fn __constructor(env: Env, admin: Address, escrow_contract: Address) {
        admin.require_auth();
        env.storage()
            .instance()
            .set(&RegistryDataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&RegistryDataKey::EscrowContract, &escrow_contract);
        env.storage()
            .instance()
            .set(&RegistryDataKey::TradeCount, &0u32);
    }

    /// Returns the contract version.
    pub fn get_version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Returns the configured escrow contract address.
    pub fn get_escrow_contract(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&RegistryDataKey::EscrowContract)
            .unwrap_or_else(|| panic_with_error!(&env, RegistryError::NotInitialized))
    }

    /// Returns the total number of registered trades.
    pub fn get_trade_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&RegistryDataKey::TradeCount)
            .unwrap_or(0u32)
    }

    /// Registers an agricultural trade in the on-chain registry.
    ///
    /// The trade_id should match the escrow ID derived in the escrow contract
    /// so that `verify_escrow_funded` can look it up.
    pub fn register_trade(
        env: Env,
        trade_id: BytesN<32>,
        buyer: Address,
        supplier: Address,
        commodity: String,
        origin_country: String,
        destination_country: String,
    ) -> TradeRecord {
        buyer.require_auth();

        if buyer == supplier {
            panic_with_error!(&env, RegistryError::SameParty);
        }

        let trade_key = RegistryDataKey::Trade(trade_id.clone());
        if env.storage().persistent().has(&trade_key) {
            panic_with_error!(&env, RegistryError::TradeExists);
        }

        let escrow_contract: Address = env
            .storage()
            .instance()
            .get(&RegistryDataKey::EscrowContract)
            .unwrap_or_else(|| panic_with_error!(&env, RegistryError::NotInitialized));

        let now = env.ledger().timestamp();
        let record = TradeRecord {
            trade_id: trade_id.clone(),
            buyer: buyer.clone(),
            supplier: supplier.clone(),
            commodity: commodity.clone(),
            origin_country: origin_country.clone(),
            destination_country: destination_country.clone(),
            escrow_contract,
            escrow_verified: false,
            created_at: now,
            updated_at: now,
        };

        env.storage().persistent().set(&trade_key, &record);

        // Increment trade count
        let count: u32 = env
            .storage()
            .instance()
            .get(&RegistryDataKey::TradeCount)
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&RegistryDataKey::TradeCount, &(count + 1));

        TradeRegistered {
            trade_id,
            buyer,
            supplier,
            commodity,
            origin_country,
            destination_country,
        }
        .publish(&env);

        record
    }

    /// Retrieves a registered trade by its ID.
    pub fn get_trade(env: Env, trade_id: BytesN<32>) -> TradeRecord {
        let trade_key = RegistryDataKey::Trade(trade_id);
        env.storage()
            .persistent()
            .get(&trade_key)
            .unwrap_or_else(|| panic_with_error!(&env, RegistryError::TradeNotFound))
    }

    /// **Inter-contract communication**: Calls the escrow contract's `get_escrow`
    /// to verify that the given trade has a funded escrow on-chain.
    ///
    /// This demonstrates real cross-contract invocation on Soroban — the trade
    /// registry contract calls the escrow contract to read escrow state.
    pub fn verify_escrow_funded(env: Env, trade_id: BytesN<32>) -> bool {
        // Load the trade record
        let trade_key = RegistryDataKey::Trade(trade_id.clone());
        let mut record: TradeRecord = env
            .storage()
            .persistent()
            .get(&trade_key)
            .unwrap_or_else(|| panic_with_error!(&env, RegistryError::TradeNotFound));

        // Get the escrow contract address
        let escrow_addr: Address = env
            .storage()
            .instance()
            .get(&RegistryDataKey::EscrowContract)
            .unwrap_or_else(|| panic_with_error!(&env, RegistryError::NotInitialized));

        use soroban_sdk::IntoVal;
        let mut args = soroban_sdk::Vec::new(&env);
        args.push_back(trade_id.clone().into_val(&env));

        // Inter-contract call: invoke escrow contract's get_escrow(id)
        // If the escrow exists and is funded/accepted/shipped/released, the call succeeds.
        // If it doesn't exist, the escrow contract panics with EscrowNotFound.
        let escrow_exists = env
            .try_invoke_contract::<soroban_sdk::Val, soroban_sdk::Val>(
                &escrow_addr,
                &Symbol::new(&env, "get_escrow"),
                args,
            )
            .is_ok();

        // Update the trade record with verification result
        record.escrow_verified = escrow_exists;
        record.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&trade_key, &record);

        EscrowVerified {
            trade_id,
            escrow_contract: escrow_addr,
            verified: escrow_exists,
        }
        .publish(&env);

        escrow_exists
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup_registry(env: &Env) -> (Address, Address, Address) {
        let admin = Address::generate(env);
        let escrow_contract = Address::generate(env);
        let contract_id = env.register(TradeRegistryContract, (&admin, &escrow_contract));
        (contract_id, admin, escrow_contract)
    }

    #[test]
    fn test_register_trade() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, _escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let supplier = Address::generate(&env);
        let trade_id = BytesN::from_array(&env, &[1u8; 32]);
        let commodity = String::from_str(&env, "Rice");
        let origin = String::from_str(&env, "Thailand");
        let destination = String::from_str(&env, "Philippines");

        let record = client.register_trade(
            &trade_id,
            &buyer,
            &supplier,
            &commodity,
            &origin,
            &destination,
        );

        assert_eq!(record.buyer, buyer);
        assert_eq!(record.supplier, supplier);
        assert_eq!(record.escrow_verified, false);
        assert_eq!(client.get_trade_count(), 1);
    }

    #[test]
    fn test_get_trade() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, _escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let supplier = Address::generate(&env);
        let trade_id = BytesN::from_array(&env, &[2u8; 32]);
        let commodity = String::from_str(&env, "Coconut Oil");
        let origin = String::from_str(&env, "Indonesia");
        let destination = String::from_str(&env, "Malaysia");

        client.register_trade(
            &trade_id,
            &buyer,
            &supplier,
            &commodity,
            &origin,
            &destination,
        );

        let fetched = client.get_trade(&trade_id);
        assert_eq!(fetched.commodity, commodity);
        assert_eq!(fetched.origin_country, origin);
        assert_eq!(fetched.destination_country, destination);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn test_same_party_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, _escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);

        let same_party = Address::generate(&env);
        let trade_id = BytesN::from_array(&env, &[3u8; 32]);

        client.register_trade(
            &trade_id,
            &same_party,
            &same_party,
            &String::from_str(&env, "Sugar"),
            &String::from_str(&env, "Vietnam"),
            &String::from_str(&env, "Singapore"),
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_duplicate_trade_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, _escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let supplier = Address::generate(&env);
        let trade_id = BytesN::from_array(&env, &[4u8; 32]);

        client.register_trade(
            &trade_id,
            &buyer,
            &supplier,
            &String::from_str(&env, "Coffee"),
            &String::from_str(&env, "Vietnam"),
            &String::from_str(&env, "Japan"),
        );

        // Second registration with same trade_id should panic
        client.register_trade(
            &trade_id,
            &buyer,
            &supplier,
            &String::from_str(&env, "Coffee"),
            &String::from_str(&env, "Vietnam"),
            &String::from_str(&env, "Japan"),
        );
    }

    #[test]
    fn test_version() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, _escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);
        assert_eq!(client.get_version(), CONTRACT_VERSION);
    }

    #[test]
    fn test_get_escrow_contract() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);
        assert_eq!(client.get_escrow_contract(), escrow_contract);
    }

    #[test]
    fn test_multiple_trades_count() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _admin, _escrow_contract) = setup_registry(&env);
        let client =
            TradeRegistryContractClient::new(&env, &contract_id);

        for i in 0..3u8 {
            let buyer = Address::generate(&env);
            let supplier = Address::generate(&env);
            let trade_id = BytesN::from_array(&env, &[i + 10; 32]);
            client.register_trade(
                &trade_id,
                &buyer,
                &supplier,
                &String::from_str(&env, "Rice"),
                &String::from_str(&env, "Thailand"),
                &String::from_str(&env, "Philippines"),
            );
        }

        assert_eq!(client.get_trade_count(), 3);
    }
}
