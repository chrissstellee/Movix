#![no_main]

use libfuzzer_sys::fuzz_target;
use movix_escrow::{Config, Escrow, EscrowContract, EscrowContractClient, Status, TtlConfig};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env,
};

fuzz_target!(|data: &[u8]| {
    if data.is_empty() {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let buyer = Address::generate(&env);
    let supplier = Address::generate(&env);
    let outsider = Address::generate(&env);
    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let token = asset.address();
    let config = Config {
        treasury: treasury.clone(),
        supported_sac_addresses: vec![&env, token.clone()],
        max_fee_bps: 500,
        ttl: TtlConfig {
            threshold: 100,
            extend_to: 1_000,
        },
    };
    let contract_id = env.register(EscrowContract, (config,));
    let client = EscrowContractClient::new(&env, &contract_id);
    StellarAssetClient::new(&env, &token).mint(&buyer, &1_000_000);
    let id = BytesN::from_array(&env, &[1; 32]);
    let terms = BytesN::from_array(&env, &[2; 32]);
    let shipment = BytesN::from_array(&env, &[3; 32]);
    let delivery = BytesN::from_array(&env, &[4; 32]);
    let refund = BytesN::from_array(&env, &[5; 32]);
    let wrong_hash = BytesN::from_array(&env, &[6; 32]);
    let zero_hash = BytesN::from_array(&env, &[0; 32]);
    let funded = client.create_and_fund(
        &id, &buyer, &supplier, &token, &10_001, &125, &1_100, &terms,
    );

    for (index, byte) in data.iter().take(64).enumerate() {
        if index == 32 || byte & 0x80 != 0 {
            env.ledger().set_timestamp(1_100);
        }
        let before = client.get_escrow(&id);
        let liability_before = client.get_liability(&token);
        let contract_before = TokenClient::new(&env, &token).balance(&contract_id);
        let buyer_before = TokenClient::new(&env, &token).balance(&buyer);
        let supplier_before = TokenClient::new(&env, &token).balance(&supplier);
        let treasury_before = TokenClient::new(&env, &token).balance(&treasury);

        let succeeded = match byte % 16 {
            0 => client.try_accept(&id, &supplier, &terms).is_ok(),
            1 => client.try_mark_shipped(&id, &supplier, &shipment).is_ok(),
            2 => client.try_confirm_delivery(&id, &buyer, &delivery).is_ok(),
            3 => client.try_propose_refund(&id, &buyer, &refund).is_ok(),
            4 => client
                .try_propose_refund(&id, &supplier, &refund)
                .is_ok(),
            5 => client.try_approve_refund(&id, &buyer, &refund).is_ok(),
            6 => client
                .try_approve_refund(&id, &supplier, &refund)
                .is_ok(),
            7 => client.try_reject_refund(&id, &buyer, &refund).is_ok(),
            8 => client
                .try_reject_refund(&id, &supplier, &refund)
                .is_ok(),
            9 => client.try_withdraw_refund(&id, &buyer, &refund).is_ok(),
            10 => client
                .try_withdraw_refund(&id, &supplier, &refund)
                .is_ok(),
            11 => client.try_cancel_unaccepted(&id, &buyer).is_ok(),
            12 => client
                .try_propose_refund(&id, &outsider, &refund)
                .is_ok(),
            13 => client.try_mark_shipped(&id, &supplier, &zero_hash).is_ok(),
            14 => client.try_accept(&id, &supplier, &wrong_hash).is_ok(),
            _ => client
                .try_confirm_delivery(&id, &outsider, &delivery)
                .is_ok(),
        };

        let after = client.get_escrow(&id);
        assert_immutable(&funded, &after);
        if !succeeded {
            assert_eq!(after, before);
            assert_eq!(client.get_liability(&token), liability_before);
            assert_eq!(
                TokenClient::new(&env, &token).balance(&contract_id),
                contract_before
            );
            assert_eq!(TokenClient::new(&env, &token).balance(&buyer), buyer_before);
            assert_eq!(
                TokenClient::new(&env, &token).balance(&supplier),
                supplier_before
            );
            assert_eq!(
                TokenClient::new(&env, &token).balance(&treasury),
                treasury_before
            );
        }
        if matches!(
            before.status,
            Status::Released | Status::Refunded | Status::Cancelled
        ) {
            assert_eq!(after.status, before.status);
        }

        let expected_liability = if matches!(
            after.status,
            Status::Funded | Status::Accepted | Status::Shipped | Status::RefundPending
        ) {
            after.gross_amount
        } else {
            0
        };
        assert_eq!(client.get_liability(&token), expected_liability);
        assert_eq!(
            TokenClient::new(&env, &token).balance(&contract_id),
            expected_liability
        );
        assert_eq!(
            TokenClient::new(&env, &token).balance(&buyer)
                + TokenClient::new(&env, &token).balance(&supplier)
                + TokenClient::new(&env, &token).balance(&treasury)
                + TokenClient::new(&env, &token).balance(&contract_id),
            1_000_000
        );
    }
});

fn assert_immutable(before: &Escrow, after: &Escrow) {
    assert_eq!(after.schema_version, before.schema_version);
    assert_eq!(after.id, before.id);
    assert_eq!(after.buyer, before.buyer);
    assert_eq!(after.supplier, before.supplier);
    assert_eq!(after.token, before.token);
    assert_eq!(after.gross_amount, before.gross_amount);
    assert_eq!(after.fee_bps, before.fee_bps);
    assert_eq!(after.fee_amount, before.fee_amount);
    assert_eq!(after.created_at, before.created_at);
    assert_eq!(after.accept_by, before.accept_by);
    assert_eq!(after.terms_hash, before.terms_hash);
}
