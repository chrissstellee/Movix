#![no_main]

use libfuzzer_sys::fuzz_target;
use movix_escrow::{Config, EscrowContract, EscrowContractClient, Status, TtlConfig};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env,
};

fuzz_target!(|data: &[u8]| {
    if data.len() < 24 {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let buyer = Address::generate(&env);
    let supplier = Address::generate(&env);
    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let token = asset.address();
    let config = Config {
        treasury,
        supported_sac_addresses: vec![&env, token.clone()],
        max_fee_bps: 500,
        ttl: TtlConfig {
            threshold: 100,
            extend_to: 1_000,
        },
    };
    let contract_id = env.register(EscrowContract, (config,));
    let client = EscrowContractClient::new(&env, &contract_id);
    StellarAssetClient::new(&env, &token).mint(&buyer, &1_000_000_000);

    let id = BytesN::from_array(&env, &[data[0]; 32]);
    let terms_hash = BytesN::from_array(&env, &[data[1]; 32]);
    let mut amount_bytes = [0_u8; 16];
    amount_bytes.copy_from_slice(&data[2..18]);
    let raw_amount = i128::from_le_bytes(amount_bytes);
    let amount = match data[18] % 5 {
        0 => raw_amount,
        1 => 0,
        2 => -raw_amount.saturating_abs(),
        3 => i128::MAX,
        _ => raw_amount.saturating_abs() % 1_000_000_001,
    };
    let fee_bps = u32::from_le_bytes([data[19], data[20], data[21], data[22]]) % 10_002;
    let accept_by = match data[23] % 4 {
        0 => 999,
        1 => 1_000,
        2 => 1_001,
        _ => 1_100,
    };

    let buyer_before = TokenClient::new(&env, &token).balance(&buyer);
    let result = client.try_create_and_fund(
        &id,
        &buyer,
        &supplier,
        &token,
        &amount,
        &fee_bps,
        &accept_by,
        &terms_hash,
    );
    if let Ok(escrow) = result {
        assert_eq!(escrow.status, Status::Funded);
        assert!(escrow.gross_amount > 0);
        assert!(escrow.fee_amount >= 0);
        assert_eq!(client.get_liability(&token), escrow.gross_amount);
        assert_eq!(
            TokenClient::new(&env, &token).balance(&contract_id),
            escrow.gross_amount
        );
        assert_eq!(
            TokenClient::new(&env, &token).balance(&buyer),
            buyer_before - escrow.gross_amount
        );
    } else {
        assert_eq!(client.get_liability(&token), 0);
        assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 0);
        assert_eq!(TokenClient::new(&env, &token).balance(&buyer), buyer_before);
    }
});
