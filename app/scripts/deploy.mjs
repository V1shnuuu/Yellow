import { Keypair, TransactionBuilder, Networks, Operation, rpc, Address, scValToNative } from '@stellar/stellar-sdk';
import fs from 'fs';

async function main() {
  const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
  const sourceKeypair = Keypair.random();
  console.log("Source Address:", sourceKeypair.publicKey());
  
  // Fund the account
  console.log("Funding account...");
  await fetch(`https://friendbot.stellar.org?addr=${sourceKeypair.publicKey()}`);
  console.log("Account funded.");

  const account = await rpcServer.getAccount(sourceKeypair.publicKey());
  const wasm = fs.readFileSync('../contracts/auction/target/wasm32-unknown-unknown/release/auction.optimized.wasm');

  // 1. Upload contract WASM
  const uploadOperation = Operation.uploadContractWasm({ wasm });
  let tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: Networks.TESTNET })
    .addOperation(uploadOperation)
    .setTimeout(30)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(sourceKeypair);

  console.log("Uploading contract...");
  let sendResponse = await rpcServer.sendTransaction(tx);
  if (sendResponse.errorResultXdr) {
    console.error("Upload error:", sendResponse);
    return;
  }
  
  let txResult = await getTransaction(rpcServer, sendResponse.hash);
  if (txResult.status !== 'SUCCESS') {
    console.error("Upload failed", txResult);
    return;
  }
  const wasmId = txResult.returnValue.bytes().toString('hex');
  console.log("Wasm ID:", wasmId);

  // 2. Instantiate Contract
  const account2 = await rpcServer.getAccount(sourceKeypair.publicKey());
  const createOperation = Operation.createCustomContract({
    address: new Address(sourceKeypair.publicKey()),
    wasmHash: Buffer.from(wasmId, 'hex')
  });

  let tx2 = new TransactionBuilder(account2, { fee: "100000", networkPassphrase: Networks.TESTNET })
    .addOperation(createOperation)
    .setTimeout(30)
    .build();

  tx2 = await rpcServer.prepareTransaction(tx2);
  tx2.sign(sourceKeypair);

  console.log("Instantiating contract...");
  let sendResponse2 = await rpcServer.sendTransaction(tx2);
  let txResult2 = await getTransaction(rpcServer, sendResponse2.hash);
  
  if (txResult2.status === 'SUCCESS') {
    const contractAddress = Address.fromScVal(txResult2.returnValue).toString();
    console.log("Contract Address:", contractAddress);
    console.log("Deploy Tx Hash:", sendResponse2.hash);
  } else {
    console.error("Instantiate failed", txResult2);
  }
}

async function getTransaction(rpcServer, txHash) {
  let getResponse = await rpcServer.getTransaction(txHash);
  while (getResponse.status === 'NOT_FOUND') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    getResponse = await rpcServer.getTransaction(txHash);
  }
  return getResponse;
}

main().catch(console.error);
