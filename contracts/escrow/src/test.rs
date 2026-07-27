extern crate std;

use soroban_sdk::{testutils::Address as _, vec, Address, Env};

use crate::{Config, EscrowContract, EscrowContractClient, TtlConfig};

fn fixture(env: &Env) -> Config {
    Config {
        treasury: Address::generate(env),
        supported_sac_addresses: vec![env, Address::generate(env), Address::generate(env)],
        max_fee_bps: 0,
        ttl: TtlConfig {
            threshold: 518_400,
            extend_to: 2_073_600,
        },
    }
}

#[test]
fn constructor_stores_typed_config() {
    let env = Env::default();
    let config = fixture(&env);
    let contract_id = env.register(EscrowContract, (config.clone(),));
    let client = EscrowContractClient::new(&env, &contract_id);

    assert_eq!(client.get_config(), config);
}

#[test]
#[should_panic]
fn constructor_rejects_empty_asset_allowlist() {
    let env = Env::default();
    let mut config = fixture(&env);
    config.supported_sac_addresses = vec![&env];

    env.register(EscrowContract, (config,));
}
