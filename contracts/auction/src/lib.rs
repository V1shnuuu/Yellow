#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AuctionError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AuctionEnded = 3,
    BidTooLow = 4,
    Unauthorized = 5,
    NoRefundAvailable = 6,
    AuctionNotEnded = 7,
    AlreadyEnded = 8,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AuctionState {
    Active = 0,
    Ended = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    ItemName,
    EndTime,
    StartingPrice,
    HighestBidder,
    HighestBidAmount,
    Refunds(Address),
    IsEnded,
}

#[contract]
pub struct AuctionContract;

#[contractimpl]
impl AuctionContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        item_name: String,
        starting_price: i128,
        duration_seconds: u64,
    ) -> Result<(), AuctionError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::AlreadyInitialized);
        }

        let end_time = env.ledger().timestamp() + duration_seconds;

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ItemName, &item_name);
        env.storage().instance().set(&DataKey::StartingPrice, &starting_price);
        env.storage().instance().set(&DataKey::EndTime, &end_time);
        env.storage().instance().set(&DataKey::IsEnded, &false);

        Ok(())
    }

    pub fn place_bid(env: Env, bidder: Address, amount: i128) -> Result<(), AuctionError> {
        bidder.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::NotInitialized);
        }

        let is_ended: bool = env.storage().instance().get(&DataKey::IsEnded).unwrap();
        let end_time: u64 = env.storage().instance().get(&DataKey::EndTime).unwrap();
        
        if is_ended || env.ledger().timestamp() >= end_time {
            return Err(AuctionError::AuctionEnded);
        }

        let current_highest_amount = env
            .storage()
            .instance()
            .get(&DataKey::HighestBidAmount)
            .unwrap_or_else(|| env.storage().instance().get::<_, i128>(&DataKey::StartingPrice).unwrap() - 1);

        if amount <= current_highest_amount {
            return Err(AuctionError::BidTooLow);
        }

        // Refund the previous highest bidder
        if let Some(previous_bidder) = env.storage().instance().get::<_, Address>(&DataKey::HighestBidder) {
            let previous_amount: i128 = env.storage().instance().get(&DataKey::HighestBidAmount).unwrap();
            let current_refund = env
                .storage()
                .persistent()
                .get::<_, i128>(&DataKey::Refunds(previous_bidder.clone()))
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&DataKey::Refunds(previous_bidder), &(current_refund + previous_amount));
        }

        env.storage().instance().set(&DataKey::HighestBidder, &bidder);
        env.storage().instance().set(&DataKey::HighestBidAmount, &amount);

        // Emit new_bid event
        let topics = (Symbol::new(&env, "new_bid"), bidder.clone());
        env.events().publish(topics, amount);

        Ok(())
    }

    pub fn get_highest_bid(env: Env) -> (Option<Address>, i128) {
        let amount = env
            .storage()
            .instance()
            .get(&DataKey::HighestBidAmount)
            .unwrap_or_else(|| env.storage().instance().get::<_, i128>(&DataKey::StartingPrice).unwrap_or(0));
        let bidder = env.storage().instance().get(&DataKey::HighestBidder);
        (bidder, amount)
    }

    pub fn get_auction_state(env: Env) -> AuctionState {
        let is_ended = env.storage().instance().get::<_, bool>(&DataKey::IsEnded).unwrap_or(false);
        let end_time = env.storage().instance().get::<_, u64>(&DataKey::EndTime).unwrap_or(0);

        if is_ended || env.ledger().timestamp() >= end_time {
            AuctionState::Ended
        } else {
            AuctionState::Active
        }
    }

    pub fn end_auction(env: Env, caller: Address) -> Result<(), AuctionError> {
        caller.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::NotInitialized);
        }

        let is_ended: bool = env.storage().instance().get(&DataKey::IsEnded).unwrap();
        if is_ended {
            return Err(AuctionError::AlreadyEnded);
        }

        let end_time: u64 = env.storage().instance().get(&DataKey::EndTime).unwrap();
        if env.ledger().timestamp() < end_time {
            return Err(AuctionError::AuctionNotEnded);
        }

        env.storage().instance().set(&DataKey::IsEnded, &true);

        let winner = env.storage().instance().get::<_, Address>(&DataKey::HighestBidder);
        let final_amount = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::HighestBidAmount)
            .unwrap_or(0);

        // Emit auction_ended event
        let topics = (Symbol::new(&env, "auction_ended"), winner.clone());
        env.events().publish(topics, final_amount);

        Ok(())
    }

    pub fn withdraw_refund(env: Env, bidder: Address) -> Result<(), AuctionError> {
        bidder.require_auth();

        let refund_key = DataKey::Refunds(bidder.clone());
        let amount = env
            .storage()
            .persistent()
            .get::<_, i128>(&refund_key)
            .unwrap_or(0);

        if amount == 0 {
            return Err(AuctionError::NoRefundAvailable);
        }

        env.storage().persistent().remove(&refund_key);
        // Note: In a real app we'd trigger a token transfer here via the token contract.
        // For this assignment, registering the state update is sufficient as we assume XLM or tokens are handled.
        // Actually, if we're not handling token transfers, we just update internal state.

        Ok(())
    }
}

mod test;
