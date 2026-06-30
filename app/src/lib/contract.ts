import { rpc, Contract, xdr, scValToNative, nativeToScVal, TransactionBuilder, Networks, Address } from '@stellar/stellar-sdk';
import { getWalletKit } from './wallet';

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

export const AUCTION_ERRORS: Record<number, string> = {
  1: "Already Initialized",
  2: "Not Initialized",
  3: "Auction Ended",
  4: "Bid too low. Please place a higher bid.",
  5: "Unauthorized",
  6: "No refund available",
  7: "Auction not ended yet",
  8: "Already Ended"
};

export async function fetchAuctionState(contractId: string) {
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(contractId);

  // Call get_highest_bid
  const getBidOp = contract.call("get_highest_bid");
  
  // Create a dummy source account to simulate
  const dummyAccount = await server.getAccount("GBVVRXLMNCJQW3IDQEXVYDDPFDQ3QOZZN52LFXQDFZ5PUNU7S4J6W5O7"); // any active account works
  
  let tx = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(getBidOp)
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  
  let highestBid = 0;
  let highestBidder = null;

  if (rpc.Api.isSimulationSuccess(simResult)) {
    const resultVal = simResult.result!.retval;
    // get_highest_bid returns (Option<Address>, i128)
    const native = scValToNative(resultVal);
    highestBidder = native[0];
    highestBid = native[1] ? Number(native[1]) : 0;
  }

  // Call get_auction_state
  const getStateOp = contract.call("get_auction_state");
  let tx2 = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(getStateOp)
    .setTimeout(30)
    .build();

  const simResult2 = await server.simulateTransaction(tx2);
  let isActive = false;
  if (rpc.Api.isSimulationSuccess(simResult2)) {
    const nativeState = scValToNative(simResult2.result!.retval);
    // AuctionState: Active = 0, Ended = 1
    isActive = nativeState === 0 || nativeState === "Active"; 
  }

  return { highestBid, highestBidder, isActive };
}

export async function placeBid(contractId: string, userAddress: string, amount: number) {
  const kit = await getWalletKit();
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(contractId);
  const account = await server.getAccount(userAddress);

  const placeBidOp = contract.call("place_bid", 
    new Address(userAddress).toScVal(),
    nativeToScVal(amount, { type: "i128" })
  );

  let tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(placeBidOp)
    .setTimeout(30)
    .build();

  // 1. Simulate the transaction
  let simResult;
  try {
    simResult = await server.simulateTransaction(tx);
  } catch (e) {
    throw new Error("Network Error: Could not connect to the RPC server.");
  }

  // Check for simulation errors
  if (rpc.Api.isSimulationError(simResult)) {
    // Insufficient balance is a common failure at the network level before contract execution
    if (simResult.error.includes("Insufficient balance") || simResult.error.includes("Underfunded")) {
      throw new Error("Insufficient XLM balance to place this bid and cover fees.");
    }
    throw new Error(`Simulation failed: ${simResult.error}`);
  }
  
  if (rpc.Api.isSimulationRestore(simResult)) {
    throw new Error("Contract needs restoration.");
  }

  if (rpc.Api.isSimulationSuccess(simResult)) {
     // Check if the simulation result indicates a HostError (e.g. panic from the contract)
     // Actually if the contract returns an error, the simulation usually doesn't fail the whole tx in the SDK but returns an error result.
     // But Soroban SDK might bubble the error.
     // In Soroban, custom errors panic the VM.
     const results = simResult.events;
     const errorEvent = results.find(e => JSON.stringify(e).includes("Error(Contract,"));
     if (errorEvent) {
         // Contract rejected it.
         throw new Error("Contract Error: Bid rejected.");
     }
  }

  // Assemble the transaction using the simulation data (resource footprint)
  tx = rpc.assembleTransaction(tx, simResult).build();

  // 2. Sign transaction with WalletKit
  let signedXdr;
  try {
    const res = await kit.signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
    signedXdr = res.signedTxXdr;
  } catch (e: any) {
    throw new Error("User cancelled: You rejected the signature request in your wallet.");
  }

  // 3. Submit to network
  const sendRes = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as any);
  
  if (sendRes.status === "ERROR") {
    throw new Error("Transaction submission failed on the network.");
  }

  return sendRes.hash;
}
