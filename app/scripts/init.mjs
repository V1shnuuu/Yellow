import { Keypair, TransactionBuilder, Networks, rpc, Contract, nativeToScVal, Address } from '@stellar/stellar-sdk';

async function main() {
  const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
  const sourceKeypair = Keypair.random();
  console.log("Funding init account...");
  await fetch(`https://friendbot.stellar.org?addr=${sourceKeypair.publicKey()}`);
  
  const contractId = "CDETLPQATPAHV56B5XHLTHZVWX6BLRPG7RVBJJOX6LEW47FPLOAVUDPR";
  const contract = new Contract(contractId);
  
  const account = await rpcServer.getAccount(sourceKeypair.publicKey());
  
  // initialize(admin: Address, item_name: String, starting_price: i128, duration_seconds: u64)
  const initOp = contract.call(
    "initialize",
    new Address(sourceKeypair.publicKey()).toScVal(),
    nativeToScVal("Vintage Chronograph", { type: "string" }),
    nativeToScVal(100, { type: "i128" }), // 100 stroops (or 100 units for this demo)
    nativeToScVal(3600, { type: "u64" }) // 1 hour duration
  );
  
  let tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: Networks.TESTNET })
    .addOperation(initOp)
    .setTimeout(30)
    .build();
    
  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(sourceKeypair);
  
  console.log("Initializing contract...");
  let sendResponse = await rpcServer.sendTransaction(tx);
  if (sendResponse.errorResultXdr) {
      console.error(sendResponse);
      return;
  }
  
  let txResult = await getTransaction(rpcServer, sendResponse.hash);
  console.log("Init status:", txResult.status);
  console.log("Tx hash:", sendResponse.hash);
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
