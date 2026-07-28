extern crate std;

use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, AuthorizedFunction, Deployer as _, Events as _, Ledger as _,
    },
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env, Error as SdkError, Symbol,
};

use crate::{
    calculate_fee, Config, DataKey, Error, EscrowContract, EscrowContractClient, Status, TtlConfig,
    BPS_DENOMINATOR, CONTRACT_VERSION, ESCROW_SCHEMA_VERSION,
};

macro_rules! assert_contract_error {
    ($expression:expr, $error:expr) => {
        assert_eq!(
            $expression.err(),
            Some(Ok(SdkError::from_contract_error($error as u32)))
        )
    };
}

struct Fixture {
    env: Env,
    contract_id: Address,
    buyer: Address,
    supplier: Address,
    outsider: Address,
    treasury: Address,
    token: Address,
    second_token: Address,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);

        let buyer = Address::generate(&env);
        let supplier = Address::generate(&env);
        let outsider = Address::generate(&env);
        let treasury = Address::generate(&env);
        let first_admin = Address::generate(&env);
        let second_admin = Address::generate(&env);
        let first_asset = env.register_stellar_asset_contract_v2(first_admin);
        let second_asset = env.register_stellar_asset_contract_v2(second_admin);
        let token = first_asset.address();
        let second_token = second_asset.address();
        let config = Config {
            treasury: treasury.clone(),
            supported_sac_addresses: vec![&env, token.clone(), second_token.clone()],
            max_fee_bps: 500,
            ttl: TtlConfig {
                threshold: 100,
                extend_to: 1_000,
            },
        };
        let contract_id = env.register(EscrowContract, (config,));

        StellarAssetClient::new(&env, &token).mint(&buyer, &1_000_000);
        StellarAssetClient::new(&env, &second_token).mint(&buyer, &1_000_000);

        Self {
            env,
            contract_id,
            buyer,
            supplier,
            outsider,
            treasury,
            token,
            second_token,
        }
    }

    fn client(&self) -> EscrowContractClient<'_> {
        EscrowContractClient::new(&self.env, &self.contract_id)
    }

    fn id(&self, byte: u8) -> BytesN<32> {
        BytesN::from_array(&self.env, &[byte; 32])
    }

    fn hash(&self, byte: u8) -> BytesN<32> {
        self.id(byte)
    }

    fn fund_with(
        &self,
        id: &BytesN<32>,
        token: &Address,
        amount: i128,
        fee_bps: u32,
        accept_by: u64,
    ) {
        self.client().create_and_fund(
            id,
            &self.buyer,
            &self.supplier,
            token,
            &amount,
            &fee_bps,
            &accept_by,
            &self.hash(20),
        );
    }

    fn fund(&self, id: &BytesN<32>) {
        self.fund_with(id, &self.token, 1_000, 0, 1_100);
    }

    fn accepted(&self, id: &BytesN<32>) {
        self.fund(id);
        self.client().accept(id, &self.supplier, &self.hash(20));
    }

    fn shipped(&self, id: &BytesN<32>) {
        self.accepted(id);
        self.client()
            .mark_shipped(id, &self.supplier, &self.hash(21));
    }

    fn balance(&self, token: &Address, address: &Address) -> i128 {
        TokenClient::new(&self.env, token).balance(address)
    }
}

fn assert_root_auth(fixture: &Fixture, actor: &Address, function: &str, sub_invocations: usize) {
    let auths = fixture.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(&auths[0].0, actor);
    match &auths[0].1.function {
        AuthorizedFunction::Contract((contract, actual_function, _args)) => {
            assert_eq!(contract, &fixture.contract_id);
            assert_eq!(actual_function, &Symbol::new(&fixture.env, function));
        }
        _ => panic!("expected root contract authorization"),
    }
    assert_eq!(auths[0].1.sub_invocations.len(), sub_invocations);
}

fn is_active(status: &Status) -> bool {
    matches!(
        status,
        Status::Funded | Status::Accepted | Status::Shipped | Status::RefundPending
    )
}

fn assert_immutable_fields(before: &crate::Escrow, after: &crate::Escrow) {
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

#[test]
fn constructor_and_bounded_getters_expose_frozen_v1() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let config = client.get_config();

    assert_eq!(client.get_version(), CONTRACT_VERSION);
    assert_eq!(config.treasury, fixture.treasury);
    assert_eq!(config.supported_sac_addresses.len(), 2);
    assert_eq!(client.get_liability(&fixture.token), 0);

    let unsupported = Address::generate(&fixture.env);
    assert_contract_error!(
        client.try_get_liability(&unsupported),
        Error::UnsupportedAsset
    );
    assert_contract_error!(
        client.try_get_escrow(&fixture.id(99)),
        Error::EscrowNotFound
    );
}

#[test]
fn constructor_rejects_invalid_asset_fee_and_ttl_configuration() {
    let env = Env::default();
    let treasury = Address::generate(&env);
    let asset = Address::generate(&env);

    let invalid_configs = [
        Config {
            treasury: treasury.clone(),
            supported_sac_addresses: vec![&env],
            max_fee_bps: 0,
            ttl: TtlConfig {
                threshold: 1,
                extend_to: 2,
            },
        },
        Config {
            treasury: treasury.clone(),
            supported_sac_addresses: vec![&env, asset.clone(), asset.clone()],
            max_fee_bps: 0,
            ttl: TtlConfig {
                threshold: 1,
                extend_to: 2,
            },
        },
        Config {
            treasury: treasury.clone(),
            supported_sac_addresses: vec![&env, asset.clone()],
            max_fee_bps: 10_001,
            ttl: TtlConfig {
                threshold: 1,
                extend_to: 2,
            },
        },
        Config {
            treasury,
            supported_sac_addresses: vec![&env, asset.clone()],
            max_fee_bps: 0,
            ttl: TtlConfig {
                threshold: 0,
                extend_to: 2,
            },
        },
        Config {
            treasury: Address::generate(&env),
            supported_sac_addresses: vec![&env, asset],
            max_fee_bps: 0,
            ttl: TtlConfig {
                threshold: 1,
                extend_to: env.storage().max_ttl().saturating_add(1),
            },
        },
    ];

    for config in invalid_configs {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            env.register(EscrowContract, (config,))
        }));
        assert!(result.is_err());
    }
}

#[test]
fn create_and_fund_uses_real_sac_and_tracks_exact_liability() {
    let fixture = Fixture::new();
    let id = fixture.id(1);
    let before = fixture.balance(&fixture.token, &fixture.buyer);
    let escrow = fixture.client().create_and_fund(
        &id,
        &fixture.buyer,
        &fixture.supplier,
        &fixture.token,
        &10_001,
        &125,
        &1_100,
        &fixture.hash(20),
    );

    assert_eq!(escrow.schema_version, ESCROW_SCHEMA_VERSION);
    assert_eq!(escrow.status, Status::Funded);
    assert_eq!(escrow.fee_amount, 125);
    assert_eq!(escrow.created_at, 1_000);
    assert_eq!(escrow.last_updated_at, 1_000);
    assert_eq!(fixture.client().get_liability(&fixture.token), 10_001);
    assert_eq!(
        fixture.balance(&fixture.token, &fixture.contract_id),
        10_001
    );
    assert_eq!(
        fixture.balance(&fixture.token, &fixture.buyer),
        before - 10_001
    );
}

#[test]
fn funding_validation_is_atomic_and_duplicate_safe() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let zero_hash = BytesN::from_array(&fixture.env, &[0; 32]);
    let unsupported = Address::generate(&fixture.env);

    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(1),
            &fixture.buyer,
            &fixture.buyer,
            &fixture.token,
            &100,
            &0,
            &1_100,
            &fixture.hash(20),
        ),
        Error::SameParty
    );
    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(2),
            &fixture.buyer,
            &fixture.supplier,
            &unsupported,
            &100,
            &0,
            &1_100,
            &fixture.hash(20),
        ),
        Error::UnsupportedAsset
    );
    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(3),
            &fixture.buyer,
            &fixture.supplier,
            &fixture.token,
            &0,
            &0,
            &1_100,
            &fixture.hash(20),
        ),
        Error::InvalidAmount
    );
    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(4),
            &fixture.buyer,
            &fixture.supplier,
            &fixture.token,
            &100,
            &501,
            &1_100,
            &fixture.hash(20),
        ),
        Error::FeeTooHigh
    );
    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(5),
            &fixture.buyer,
            &fixture.supplier,
            &fixture.token,
            &100,
            &0,
            &1_000,
            &fixture.hash(20),
        ),
        Error::InvalidDeadline
    );
    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(6),
            &fixture.buyer,
            &fixture.supplier,
            &fixture.token,
            &100,
            &0,
            &1_100,
            &zero_hash,
        ),
        Error::InvalidHash
    );
    assert_eq!(client.get_liability(&fixture.token), 0);
    assert_eq!(fixture.balance(&fixture.token, &fixture.contract_id), 0);

    fixture.fund(&fixture.id(7));
    assert_contract_error!(
        client.try_create_and_fund(
            &fixture.id(7),
            &fixture.buyer,
            &fixture.supplier,
            &fixture.token,
            &100,
            &0,
            &1_100,
            &fixture.hash(20),
        ),
        Error::EscrowExists
    );
    assert_eq!(client.get_liability(&fixture.token), 1_000);
}

#[test]
fn failed_sac_transfer_and_fee_overflow_leave_no_financial_state() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let insufficient_id = fixture.id(16);
    let overflow_id = fixture.id(17);

    let failed_transfer = client.try_create_and_fund(
        &insufficient_id,
        &fixture.buyer,
        &fixture.supplier,
        &fixture.token,
        &1_000_001,
        &0,
        &1_100,
        &fixture.hash(20),
    );
    assert!(failed_transfer.is_err());
    assert_contract_error!(
        client.try_get_escrow(&insufficient_id),
        Error::EscrowNotFound
    );

    assert_contract_error!(
        client.try_create_and_fund(
            &overflow_id,
            &fixture.buyer,
            &fixture.supplier,
            &fixture.token,
            &i128::MAX,
            &500,
            &1_100,
            &fixture.hash(20),
        ),
        Error::ArithmeticFailure
    );
    assert_contract_error!(client.try_get_escrow(&overflow_id), Error::EscrowNotFound);
    assert_eq!(client.get_liability(&fixture.token), 0);
    assert_eq!(fixture.balance(&fixture.token, &fixture.contract_id), 0);
}

#[test]
fn checked_fee_arithmetic_matches_floor_division_across_many_inputs() {
    let env = Env::default();
    let mut state = 0x9e37_79b9_7f4a_7c15_u64;

    for _ in 0..10_000 {
        state = state
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        let amount = i128::from((state % 1_000_000_000) + 1);
        let fee_bps = ((state >> 32) % 501) as u32;
        let expected = amount * i128::from(fee_bps) / BPS_DENOMINATOR;

        assert_eq!(calculate_fee(&env, amount, fee_bps), expected);
    }
}

#[test]
fn exact_authorization_tree_includes_nested_sac_transfer() {
    let fixture = Fixture::new();
    let id = fixture.id(8);
    fixture.fund(&id);
    let auths = fixture.env.auths();

    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, fixture.buyer);
    match &auths[0].1.function {
        AuthorizedFunction::Contract((contract, function, _args)) => {
            assert_eq!(contract, &fixture.contract_id);
            assert_eq!(function, &Symbol::new(&fixture.env, "create_and_fund"));
        }
        _ => panic!("expected root contract authorization"),
    }
    assert_eq!(auths[0].1.sub_invocations.len(), 1);
    match &auths[0].1.sub_invocations[0].function {
        AuthorizedFunction::Contract((contract, function, _args)) => {
            assert_eq!(contract, &fixture.token);
            assert_eq!(function, &Symbol::new(&fixture.env, "transfer"));
        }
        _ => panic!("expected nested SAC transfer authorization"),
    }
}

#[test]
fn supplier_accepts_matching_terms_before_deadline_and_ships_once() {
    let fixture = Fixture::new();
    let id = fixture.id(9);
    fixture.fund(&id);
    let client = fixture.client();

    assert_contract_error!(
        client.try_accept(&id, &fixture.outsider, &fixture.hash(20)),
        Error::UnauthorizedParty
    );
    assert_contract_error!(
        client.try_accept(&id, &fixture.supplier, &fixture.hash(22)),
        Error::TermsMismatch
    );
    let accepted = client.accept(&id, &fixture.supplier, &fixture.hash(20));
    assert_eq!(accepted.status, Status::Accepted);
    assert_eq!(client.get_liability(&fixture.token), 1_000);

    let zero_hash = BytesN::from_array(&fixture.env, &[0; 32]);
    assert_contract_error!(
        client.try_mark_shipped(&id, &fixture.supplier, &zero_hash),
        Error::InvalidHash
    );
    let shipped = client.mark_shipped(&id, &fixture.supplier, &fixture.hash(21));
    assert_eq!(shipped.status, Status::Shipped);
    assert_eq!(shipped.shipment_hash, Some(fixture.hash(21)));
    assert_contract_error!(
        client.try_mark_shipped(&id, &fixture.supplier, &fixture.hash(21)),
        Error::InvalidTransition
    );
}

#[test]
fn acceptance_deadline_belongs_to_cancellation() {
    let fixture = Fixture::new();
    let id = fixture.id(10);
    fixture.fund(&id);
    fixture.env.ledger().set_timestamp(1_100);

    assert_contract_error!(
        fixture
            .client()
            .try_accept(&id, &fixture.supplier, &fixture.hash(20)),
        Error::AcceptanceExpired
    );
    let cancelled = fixture.client().cancel_unaccepted(&id, &fixture.buyer);
    assert_eq!(cancelled.status, Status::Cancelled);
}

#[test]
fn delivery_release_conserves_gross_and_is_terminal() {
    let fixture = Fixture::new();
    let id = fixture.id(11);
    fixture.fund_with(&id, &fixture.second_token, 10_001, 125, 1_100);
    fixture
        .client()
        .accept(&id, &fixture.supplier, &fixture.hash(20));
    fixture
        .client()
        .mark_shipped(&id, &fixture.supplier, &fixture.hash(21));

    let released = fixture
        .client()
        .confirm_delivery(&id, &fixture.buyer, &fixture.hash(22));
    assert_eq!(released.status, Status::Released);
    assert_eq!(released.delivery_hash, Some(fixture.hash(22)));
    assert_eq!(
        fixture.balance(&fixture.second_token, &fixture.supplier),
        9_876
    );
    assert_eq!(
        fixture.balance(&fixture.second_token, &fixture.treasury),
        125
    );
    assert_eq!(
        fixture.balance(&fixture.second_token, &fixture.contract_id),
        0
    );
    assert_eq!(fixture.client().get_liability(&fixture.second_token), 0);

    assert_contract_error!(
        fixture
            .client()
            .try_confirm_delivery(&id, &fixture.buyer, &fixture.hash(22)),
        Error::InvalidTransition
    );
}

#[test]
fn corrupted_liability_fails_closed_before_payout() {
    let fixture = Fixture::new();
    let id = fixture.id(23);
    fixture.shipped(&id);
    let supplier_before = fixture.balance(&fixture.token, &fixture.supplier);
    let contract_before = fixture.balance(&fixture.token, &fixture.contract_id);

    fixture.env.as_contract(&fixture.contract_id, || {
        fixture
            .env
            .storage()
            .persistent()
            .set(&DataKey::Liability(fixture.token.clone()), &0_i128);
    });

    assert_contract_error!(
        fixture
            .client()
            .try_confirm_delivery(&id, &fixture.buyer, &fixture.hash(22)),
        Error::InvariantViolation
    );
    assert_eq!(fixture.client().get_escrow(&id).status, Status::Shipped);
    assert_eq!(
        fixture.balance(&fixture.token, &fixture.supplier),
        supplier_before
    );
    assert_eq!(
        fixture.balance(&fixture.token, &fixture.contract_id),
        contract_before
    );
}

#[test]
fn refund_reject_and_withdraw_restore_exact_active_state() {
    let fixture = Fixture::new();
    let accepted_id = fixture.id(12);
    fixture.accepted(&accepted_id);
    let refund_hash = fixture.hash(30);

    let pending = fixture
        .client()
        .propose_refund(&accepted_id, &fixture.buyer, &refund_hash);
    assert_eq!(pending.status, Status::RefundPending);
    assert_eq!(pending.resume_status, Some(Status::Accepted));
    assert_contract_error!(
        fixture
            .client()
            .try_approve_refund(&accepted_id, &fixture.buyer, &refund_hash),
        Error::SamePartyApproval
    );
    assert_contract_error!(
        fixture
            .client()
            .try_reject_refund(&accepted_id, &fixture.supplier, &fixture.hash(31),),
        Error::RefundTermsMismatch
    );
    let restored = fixture
        .client()
        .reject_refund(&accepted_id, &fixture.supplier, &refund_hash);
    assert_eq!(restored.status, Status::Accepted);
    assert_eq!(restored.resume_status, None);
    assert_eq!(restored.refund_proposer, None);
    assert_eq!(restored.refund_terms_hash, None);

    fixture
        .client()
        .propose_refund(&accepted_id, &fixture.supplier, &refund_hash);
    assert_contract_error!(
        fixture
            .client()
            .try_withdraw_refund(&accepted_id, &fixture.buyer, &refund_hash,),
        Error::RefundProposerMismatch
    );
    let withdrawn = fixture
        .client()
        .withdraw_refund(&accepted_id, &fixture.supplier, &refund_hash);
    assert_eq!(withdrawn.status, Status::Accepted);
    assert_eq!(fixture.client().get_liability(&fixture.token), 1_000);
}

#[test]
fn opposite_party_refund_returns_full_gross_once_from_shipped() {
    let fixture = Fixture::new();
    let id = fixture.id(13);
    fixture.shipped(&id);
    let buyer_before = fixture.balance(&fixture.token, &fixture.buyer);
    let refund_hash = fixture.hash(30);

    fixture
        .client()
        .propose_refund(&id, &fixture.supplier, &refund_hash);
    let refunded = fixture
        .client()
        .approve_refund(&id, &fixture.buyer, &refund_hash);

    assert_eq!(refunded.status, Status::Refunded);
    assert_eq!(refunded.resume_status, None);
    assert_eq!(refunded.refund_proposer, Some(fixture.supplier.clone()));
    assert_eq!(refunded.refund_terms_hash, Some(refund_hash.clone()));
    assert_eq!(
        fixture.balance(&fixture.token, &fixture.buyer),
        buyer_before + 1_000
    );
    assert_eq!(fixture.balance(&fixture.token, &fixture.contract_id), 0);
    assert_eq!(fixture.client().get_liability(&fixture.token), 0);
    assert_contract_error!(
        fixture
            .client()
            .try_approve_refund(&id, &fixture.buyer, &refund_hash),
        Error::InvalidTransition
    );
}

#[test]
fn funded_refund_requires_the_opposite_party_and_returns_full_gross() {
    let fixture = Fixture::new();
    let id = fixture.id(18);
    fixture.fund(&id);
    let refund_hash = fixture.hash(30);

    fixture
        .client()
        .propose_refund(&id, &fixture.buyer, &refund_hash);
    assert_contract_error!(
        fixture
            .client()
            .try_approve_refund(&id, &fixture.outsider, &refund_hash),
        Error::UnauthorizedParty
    );
    let refunded = fixture
        .client()
        .approve_refund(&id, &fixture.supplier, &refund_hash);

    assert_eq!(refunded.status, Status::Refunded);
    assert_eq!(refunded.refund_proposer, Some(fixture.buyer.clone()));
    assert_eq!(fixture.client().get_liability(&fixture.token), 0);
    assert_eq!(fixture.balance(&fixture.token, &fixture.contract_id), 0);
}

#[test]
fn cancellation_is_buyer_only_full_and_terminal() {
    let fixture = Fixture::new();
    let id = fixture.id(14);
    fixture.fund(&id);
    let buyer_before = fixture.balance(&fixture.token, &fixture.buyer);

    assert_contract_error!(
        fixture.client().try_cancel_unaccepted(&id, &fixture.buyer),
        Error::CancellationTooEarly
    );
    fixture.env.ledger().set_timestamp(1_100);
    assert_contract_error!(
        fixture
            .client()
            .try_cancel_unaccepted(&id, &fixture.outsider),
        Error::UnauthorizedParty
    );
    let cancelled = fixture.client().cancel_unaccepted(&id, &fixture.buyer);
    assert_eq!(cancelled.status, Status::Cancelled);
    assert_eq!(
        fixture.balance(&fixture.token, &fixture.buyer),
        buyer_before + 1_000
    );
    assert_eq!(fixture.client().get_liability(&fixture.token), 0);
    assert_contract_error!(
        fixture.client().try_cancel_unaccepted(&id, &fixture.buyer),
        Error::InvalidTransition
    );
}

#[test]
fn successful_lifecycle_calls_publish_one_movix_event_each() {
    let fixture = Fixture::new();
    let contract_events = || {
        fixture
            .env
            .events()
            .all()
            .filter_by_contract(&fixture.contract_id)
            .events()
            .len()
    };
    let id = fixture.id(15);

    fixture.fund(&id);
    assert_eq!(contract_events(), 1);
    fixture
        .client()
        .accept(&id, &fixture.supplier, &fixture.hash(20));
    assert_eq!(contract_events(), 1);
    fixture
        .client()
        .mark_shipped(&id, &fixture.supplier, &fixture.hash(21));
    assert_eq!(contract_events(), 1);
    fixture
        .client()
        .confirm_delivery(&id, &fixture.buyer, &fixture.hash(22));
    assert_eq!(contract_events(), 1);
}

#[test]
fn every_mutator_requires_the_exact_snapshotted_actor() {
    let fixture = Fixture::new();
    let release_id = fixture.id(40);
    fixture.fund(&release_id);
    assert_root_auth(&fixture, &fixture.buyer, "create_and_fund", 1);

    fixture
        .client()
        .accept(&release_id, &fixture.supplier, &fixture.hash(20));
    assert_root_auth(&fixture, &fixture.supplier, "accept", 0);
    fixture
        .client()
        .mark_shipped(&release_id, &fixture.supplier, &fixture.hash(21));
    assert_root_auth(&fixture, &fixture.supplier, "mark_shipped", 0);
    fixture
        .client()
        .confirm_delivery(&release_id, &fixture.buyer, &fixture.hash(22));
    assert_root_auth(&fixture, &fixture.buyer, "confirm_delivery", 0);

    let refund_id = fixture.id(41);
    fixture.fund(&refund_id);
    fixture
        .client()
        .propose_refund(&refund_id, &fixture.buyer, &fixture.hash(30));
    assert_root_auth(&fixture, &fixture.buyer, "propose_refund", 0);
    fixture
        .client()
        .reject_refund(&refund_id, &fixture.supplier, &fixture.hash(30));
    assert_root_auth(&fixture, &fixture.supplier, "reject_refund", 0);

    fixture
        .client()
        .propose_refund(&refund_id, &fixture.supplier, &fixture.hash(31));
    assert_root_auth(&fixture, &fixture.supplier, "propose_refund", 0);
    fixture
        .client()
        .withdraw_refund(&refund_id, &fixture.supplier, &fixture.hash(31));
    assert_root_auth(&fixture, &fixture.supplier, "withdraw_refund", 0);

    fixture
        .client()
        .propose_refund(&refund_id, &fixture.buyer, &fixture.hash(32));
    fixture
        .client()
        .approve_refund(&refund_id, &fixture.supplier, &fixture.hash(32));
    assert_root_auth(&fixture, &fixture.supplier, "approve_refund", 0);

    let cancellation_id = fixture.id(42);
    fixture.fund(&cancellation_id);
    fixture.env.ledger().set_timestamp(1_100);
    fixture
        .client()
        .cancel_unaccepted(&cancellation_id, &fixture.buyer);
    assert_root_auth(&fixture, &fixture.buyer, "cancel_unaccepted", 0);
}

#[test]
fn ttl_extension_and_archive_restoration_preserve_deadline_and_terminal_rules() {
    let fixture = Fixture::new();
    let id = fixture.id(43);
    fixture.fund(&id);
    let escrow_key = DataKey::Escrow(id.clone());
    let liability_key = DataKey::Liability(fixture.token.clone());

    let (instance_ttl, escrow_ttl, liability_ttl) =
        fixture.env.as_contract(&fixture.contract_id, || {
            (
                fixture.env.storage().instance().get_ttl(),
                fixture.env.storage().persistent().get_ttl(&escrow_key),
                fixture.env.storage().persistent().get_ttl(&liability_key),
            )
        });
    let code_ttl = fixture
        .env
        .deployer()
        .get_contract_code_ttl(&fixture.contract_id);
    let smallest_ttl = [instance_ttl, code_ttl, escrow_ttl, liability_ttl]
        .into_iter()
        .min()
        .unwrap();
    assert!(smallest_ttl > 50);

    let current_sequence = fixture.env.ledger().sequence();
    fixture
        .env
        .ledger()
        .set_sequence_number(current_sequence + smallest_ttl - 50);
    assert_eq!(fixture.client().get_escrow(&id).status, Status::Funded);
    assert_eq!(fixture.client().get_liability(&fixture.token), 1_000);

    let (extended_instance_ttl, extended_escrow_ttl, extended_liability_ttl) =
        fixture.env.as_contract(&fixture.contract_id, || {
            (
                fixture.env.storage().instance().get_ttl(),
                fixture.env.storage().persistent().get_ttl(&escrow_key),
                fixture.env.storage().persistent().get_ttl(&liability_key),
            )
        });
    let extended_code_ttl = fixture
        .env
        .deployer()
        .get_contract_code_ttl(&fixture.contract_id);
    for ttl in [
        extended_instance_ttl,
        extended_code_ttl,
        extended_escrow_ttl,
        extended_liability_ttl,
    ] {
        assert!(ttl >= 1_000);
    }

    let archive_jump = fixture.env.storage().max_ttl() + 1;
    let current_sequence = fixture.env.ledger().sequence();
    fixture
        .env
        .ledger()
        .set_sequence_number(current_sequence + archive_jump);
    assert_eq!(fixture.client().get_escrow(&id).status, Status::Funded);
    assert_eq!(fixture.client().get_liability(&fixture.token), 1_000);

    fixture.env.ledger().set_timestamp(1_100);
    let cancelled = fixture.client().cancel_unaccepted(&id, &fixture.buyer);
    assert_eq!(cancelled.status, Status::Cancelled);
    assert_eq!(fixture.client().get_liability(&fixture.token), 0);
    assert_contract_error!(
        fixture.client().try_cancel_unaccepted(&id, &fixture.buyer),
        Error::InvalidTransition
    );
}

#[test]
fn arbitrary_lifecycle_sequences_preserve_financial_and_immutable_properties() {
    const ESCROW_COUNT: usize = 24;
    const ACTION_COUNT: usize = 1_024;

    let fixture = Fixture::new();
    let client = fixture.client();
    let ids: std::vec::Vec<_> = (0..ESCROW_COUNT)
        .map(|index| fixture.id(60 + index as u8))
        .collect();
    let mut statuses = std::vec::Vec::with_capacity(ESCROW_COUNT);
    for id in &ids {
        fixture.fund(id);
        statuses.push(Status::Funded);
    }

    let zero_hash = BytesN::from_array(&fixture.env, &[0; 32]);
    let mut seed = 0xd1b5_4a32_d192_ed03_u64;
    for iteration in 0..ACTION_COUNT {
        seed = seed
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        let index = (seed as usize) % ESCROW_COUNT;
        let action = ((seed >> 32) % 16) as u8;
        let id = &ids[index];
        let before = client.get_escrow(id);
        let liability_before = client.get_liability(&fixture.token);
        let contract_balance_before = fixture.balance(&fixture.token, &fixture.contract_id);
        let buyer_balance_before = fixture.balance(&fixture.token, &fixture.buyer);
        let supplier_balance_before = fixture.balance(&fixture.token, &fixture.supplier);
        let treasury_balance_before = fixture.balance(&fixture.token, &fixture.treasury);

        if iteration == ACTION_COUNT / 2 {
            fixture.env.ledger().set_timestamp(1_100);
        }

        let succeeded = match action {
            0 => client
                .try_accept(id, &fixture.supplier, &fixture.hash(20))
                .is_ok(),
            1 => client
                .try_mark_shipped(id, &fixture.supplier, &fixture.hash(21))
                .is_ok(),
            2 => client
                .try_confirm_delivery(id, &fixture.buyer, &fixture.hash(22))
                .is_ok(),
            3 => client
                .try_propose_refund(id, &fixture.buyer, &fixture.hash(30))
                .is_ok(),
            4 => client
                .try_propose_refund(id, &fixture.supplier, &fixture.hash(30))
                .is_ok(),
            5 => client
                .try_approve_refund(id, &fixture.buyer, &fixture.hash(30))
                .is_ok(),
            6 => client
                .try_approve_refund(id, &fixture.supplier, &fixture.hash(30))
                .is_ok(),
            7 => client
                .try_reject_refund(id, &fixture.buyer, &fixture.hash(30))
                .is_ok(),
            8 => client
                .try_reject_refund(id, &fixture.supplier, &fixture.hash(30))
                .is_ok(),
            9 => client
                .try_withdraw_refund(id, &fixture.buyer, &fixture.hash(30))
                .is_ok(),
            10 => client
                .try_withdraw_refund(id, &fixture.supplier, &fixture.hash(30))
                .is_ok(),
            11 => client.try_cancel_unaccepted(id, &fixture.buyer).is_ok(),
            12 => client
                .try_propose_refund(id, &fixture.outsider, &fixture.hash(30))
                .is_ok(),
            13 => client
                .try_mark_shipped(id, &fixture.supplier, &zero_hash)
                .is_ok(),
            14 => client
                .try_accept(id, &fixture.supplier, &fixture.hash(99))
                .is_ok(),
            _ => client
                .try_confirm_delivery(id, &fixture.buyer, &fixture.hash(22))
                .is_ok(),
        };

        let after = client.get_escrow(id);
        assert_immutable_fields(&before, &after);
        if !succeeded {
            assert_eq!(after, before);
            assert_eq!(client.get_liability(&fixture.token), liability_before);
            assert_eq!(
                fixture.balance(&fixture.token, &fixture.contract_id),
                contract_balance_before
            );
            assert_eq!(
                fixture.balance(&fixture.token, &fixture.buyer),
                buyer_balance_before
            );
            assert_eq!(
                fixture.balance(&fixture.token, &fixture.supplier),
                supplier_balance_before
            );
            assert_eq!(
                fixture.balance(&fixture.token, &fixture.treasury),
                treasury_balance_before
            );
        }
        if matches!(
            before.status,
            Status::Released | Status::Refunded | Status::Cancelled
        ) {
            assert_eq!(after.status, before.status);
        }

        statuses[index] = after.status;
        let expected_liability =
            statuses.iter().filter(|status| is_active(status)).count() as i128 * 1_000;
        assert_eq!(client.get_liability(&fixture.token), expected_liability);
        assert_eq!(
            fixture.balance(&fixture.token, &fixture.contract_id),
            expected_liability
        );
        assert_eq!(
            fixture.balance(&fixture.token, &fixture.buyer)
                + fixture.balance(&fixture.token, &fixture.supplier)
                + fixture.balance(&fixture.token, &fixture.treasury)
                + fixture.balance(&fixture.token, &fixture.contract_id),
            1_000_000
        );
    }
}

#[test]
fn multi_asset_multi_escrow_liabilities_reconcile_after_serialized_races() {
    let fixture = Fixture::new();
    let xlm_release = fixture.id(90);
    let xlm_refund = fixture.id(91);
    let usdc_cancel = fixture.id(92);

    fixture.fund_with(&xlm_release, &fixture.token, 2_000, 100, 1_100);
    fixture.fund_with(&xlm_refund, &fixture.token, 3_000, 0, 1_100);
    fixture.fund_with(&usdc_cancel, &fixture.second_token, 4_000, 0, 1_100);
    assert_eq!(fixture.client().get_liability(&fixture.token), 5_000);
    assert_eq!(fixture.client().get_liability(&fixture.second_token), 4_000);

    fixture
        .client()
        .accept(&xlm_release, &fixture.supplier, &fixture.hash(20));
    fixture
        .client()
        .mark_shipped(&xlm_release, &fixture.supplier, &fixture.hash(21));
    fixture
        .client()
        .propose_refund(&xlm_release, &fixture.supplier, &fixture.hash(30));
    assert_contract_error!(
        fixture
            .client()
            .try_confirm_delivery(&xlm_release, &fixture.buyer, &fixture.hash(22)),
        Error::InvalidTransition
    );
    fixture
        .client()
        .reject_refund(&xlm_release, &fixture.buyer, &fixture.hash(30));
    fixture
        .client()
        .confirm_delivery(&xlm_release, &fixture.buyer, &fixture.hash(22));
    assert_eq!(fixture.client().get_liability(&fixture.token), 3_000);

    fixture
        .client()
        .propose_refund(&xlm_refund, &fixture.buyer, &fixture.hash(31));
    fixture
        .client()
        .approve_refund(&xlm_refund, &fixture.supplier, &fixture.hash(31));
    assert_eq!(fixture.client().get_liability(&fixture.token), 0);

    fixture.env.ledger().set_timestamp(1_100);
    fixture
        .client()
        .cancel_unaccepted(&usdc_cancel, &fixture.buyer);
    assert_eq!(fixture.client().get_liability(&fixture.second_token), 0);
    assert_eq!(fixture.balance(&fixture.token, &fixture.contract_id), 0);
    assert_eq!(
        fixture.balance(&fixture.second_token, &fixture.contract_id),
        0
    );
}
