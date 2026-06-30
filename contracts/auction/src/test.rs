#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Env};

#[test]
fn test_successful_bid() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AuctionContract, ());
    let client = AuctionContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let item_name = String::from_str(&env, "Test Item");
    let starting_price = 100;
    let duration = 60; // 60 seconds

    client.initialize(&admin, &item_name, &starting_price, &duration);

    let bidder1 = Address::generate(&env);
    client.place_bid(&bidder1, &150);

    let (highest_bidder, highest_amount) = client.get_highest_bid();
    assert_eq!(highest_bidder, Some(bidder1.clone()));
    assert_eq!(highest_amount, 150);

    // Another successful bid
    let bidder2 = Address::generate(&env);
    client.place_bid(&bidder2, &200);

    let (highest_bidder2, highest_amount2) = client.get_highest_bid();
    assert_eq!(highest_bidder2, Some(bidder2));
    assert_eq!(highest_amount2, 200);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_bid_too_low_rejection() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AuctionContract, ());
    let client = AuctionContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let item_name = String::from_str(&env, "Test Item");
    client.initialize(&admin, &item_name, &100, &60);

    let bidder1 = Address::generate(&env);
    client.place_bid(&bidder1, &150);

    let bidder2 = Address::generate(&env);
    // This should panic with BidTooLow (4)
    client.place_bid(&bidder2, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_bid_after_expiry_rejection() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AuctionContract, ());
    let client = AuctionContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let item_name = String::from_str(&env, "Test Item");
    client.initialize(&admin, &item_name, &100, &60);

    // Fast forward time past expiry
    env.ledger().with_mut(|li| {
        li.timestamp = li.timestamp + 61;
    });

    let bidder1 = Address::generate(&env);
    // This should panic with AuctionEnded (3)
    client.place_bid(&bidder1, &150);
}
