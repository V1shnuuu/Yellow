"use client";

import { useEffect, useState, useCallback } from "react";
import { getWalletKit } from "@/lib/wallet";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchAuctionState, placeBid } from "@/lib/contract";
import { rpc, scValToNative } from "@stellar/stellar-sdk";

import { WalletModal } from "@/components/WalletModal";

const CONTRACT_ID = "CDETLPQATPAHV56B5XHLTHZVWX6BLRPG7RVBJJOX6LEW47FPLOAVUDPR";
const RPC_URL = "https://soroban-testnet.stellar.org";

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Auction state
  const [highestBid, setHighestBid] = useState<number>(0);
  const [highestBidder, setHighestBidder] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [bidAmount, setBidAmount] = useState<string>("");
  const [isBidding, setIsBidding] = useState(false);
  
  // Live Feed
  const [events, setEvents] = useState<any[]>([]);

  const connectWallet = () => {
    setIsWalletModalOpen(true);
  };

  const handleWalletSelect = async (walletId: string) => {
    setIsWalletModalOpen(false);
    setIsConnecting(true);
    setError(null);
    try {
      const kit = getWalletKit();
      kit.setWallet(walletId);
      const { address } = await kit.getAddress();
      setAddress(address);
    } catch (err: any) {
      if (err?.message?.includes("Wallet not found") || err?.message?.includes("is not installed")) {
        setError(`Wallet not found. Please install the ${walletId} extension.`);
      } else {
        setError("User rejected signature or connection cancelled.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!address) return;
    setError(null);
    setSuccessMsg(null);
    setTxHash(null);
    setIsBidding(true);
    
    try {
      const parsedAmount = parseInt(bidAmount);
      if (isNaN(parsedAmount) || parsedAmount <= highestBid) {
         throw new Error("Bid must be higher than current highest bid.");
      }
      
      const hash = await placeBid(CONTRACT_ID, address, parsedAmount);
      setSuccessMsg("Bid placed successfully!");
      setTxHash(hash);
      setBidAmount("");
      
      // Refresh state eagerly
      const state = await fetchAuctionState(CONTRACT_ID);
      setHighestBid(state.highestBid);
      setHighestBidder(state.highestBidder);
      setIsActive(state.isActive);
      
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsBidding(false);
    }
  };

  const fetchState = useCallback(async () => {
    try {
      const state = await fetchAuctionState(CONTRACT_ID);
      setHighestBid(state.highestBid);
      setHighestBidder(state.highestBidder);
      setIsActive(state.isActive);
    } catch (err) {
      console.error("Failed to fetch initial state:", err);
    }
  }, []);

  const pollEvents = useCallback(async () => {
    const server = new rpc.Server(RPC_URL);
    let latestLedger = 0;
    
    try {
        const network = await server.getLatestLedger();
        latestLedger = network.sequence;
    } catch (e) {
        return; // Ignore network issues for polling start
    }
    
    const interval = setInterval(async () => {
      try {
        const response = await server.getEvents({
          startLedger: latestLedger,
          filters: [
            {
              type: "contract",
              contractIds: [CONTRACT_ID]
            }
          ]
        });
        
        if (response.events && response.events.length > 0) {
          const newEvents = response.events.map(e => {
            const topic = scValToNative(e.topic[0]);
            let data = null;
            try { data = scValToNative(e.value); } catch(err) {}
            return { type: topic, data };
          }).filter(e => e.type === "new_bid" || e.type === "auction_ended");
          
          if (newEvents.length > 0) {
            setEvents(prev => [...newEvents, ...prev]);
            
            // Auto update top bid if we see a new_bid event
            const latestBidEvent = newEvents.find(e => e.type === "new_bid");
            if (latestBidEvent && latestBidEvent.data) {
                setHighestBid(Number(latestBidEvent.data[1]));
                setHighestBidder(latestBidEvent.data[0]);
            }
            if (newEvents.some(e => e.type === "auction_ended")) {
                setIsActive(false);
            }
          }
        }
        
        const latest = await server.getLatestLedger();
        if (latest.sequence > latestLedger) {
            latestLedger = latest.sequence;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchState();
    const cleanup = pollEvents();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [fetchState, pollEvents]);

  return (
    <main className="min-h-screen bg-charcoal-800 p-8 flex justify-center items-center font-sans">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Main Auction Card */}
      <div className="lg:col-span-2 space-y-6">
        <div className="p-8 rounded-2xl bg-charcoal-700/50 border border-white/10 backdrop-blur-sm shadow-xl">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-serif font-bold text-gold-500 mb-2">Vintage Chronograph</h2>
              <p className="text-foreground/70">A rare piece of history. Bidding ends soon.</p>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {isActive ? 'Active' : 'Ended'}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="p-6 rounded-xl bg-charcoal-900/50 border border-white/5">
              <p className="text-sm text-foreground/60 mb-1">Current Highest Bid</p>
              <p className="text-4xl font-mono font-bold text-white">{highestBid} <span className="text-xl text-gold-500">XLM</span></p>
              <p className="text-xs text-foreground/40 mt-2 font-mono truncate">
                by {highestBidder ? `${highestBidder.slice(0,6)}...${highestBidder.slice(-4)}` : 'No bids yet'}
              </p>
            </div>
            <div className="p-6 rounded-xl bg-charcoal-900/50 border border-white/5 flex flex-col justify-center">
              <p className="text-sm text-foreground/60 mb-1">Time Remaining</p>
              <p className="text-3xl font-mono font-bold text-white">00:59:23</p>
            </div>
          </div>

          <div className="space-y-4">
            {!address ? (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="w-full py-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-900 font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting && <Loader2 className="animate-spin w-5 h-5" />}
                Connect Wallet to Bid
              </button>
            ) : (
              <div className="flex gap-4">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter bid amount"
                  className="flex-1 bg-charcoal-900 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-gold-500/50 transition-colors"
                />
                <button
                  onClick={handlePlaceBid}
                  disabled={isBidding || !isActive}
                  className="px-8 rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-900 font-bold transition-all disabled:opacity-50 disabled:hover:bg-gold-500 flex items-center gap-2"
                >
                  {isBidding && <Loader2 className="animate-spin w-5 h-5" />}
                  Place Bid
                </button>
              </div>
            )}
          </div>
          
          {/* Status Messages */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start flex-col gap-2 text-green-400">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm">{successMsg}</p>
              </div>
              {txHash && (
                 <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-xs text-gold-500 underline ml-8 font-mono">
                    View Transaction on Explorer
                 </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Feed Sidebar */}
      <div className="space-y-4">
        <h3 className="font-serif text-xl text-white font-semibold">Live Feed</h3>
        <div className="bg-charcoal-700/30 rounded-2xl border border-white/5 p-4 h-[500px] overflow-y-auto space-y-3">
          {events.length === 0 ? (
            <p className="text-center text-foreground/40 text-sm mt-8">Waiting for events...</p>
          ) : (
            events.map((evt, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-charcoal-800 border border-white/5 text-sm font-mono flex flex-col gap-1">
                {evt.type === "new_bid" ? (
                    <>
                        <span className="text-gold-500">New Bid!</span>
                        <span className="text-foreground/70">Amount: {evt.data ? Number(evt.data[1]) : 0} XLM</span>
                        <span className="text-xs text-foreground/40 truncate">{evt.data ? evt.data[0] : ""}</span>
                    </>
                ) : (
                    <span className="text-red-400 font-bold">Auction Ended</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      </div>
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
        onSelectWallet={handleWalletSelect} 
      />
    </main>
  );
}
