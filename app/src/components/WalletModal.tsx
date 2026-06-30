"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (id: string) => void;
}

const WALLETS = [
  {
    id: "freighter",
    name: "Freighter",
    icon: "🛳️", // We can use emojis or SVG if we don't have images
    description: "The official Stellar wallet extension."
  },
  {
    id: "albedo",
    name: "Albedo",
    icon: "☀️",
    description: "Browser-based delegated signer."
  },
  {
    id: "xbull",
    name: "xBull",
    icon: "🐂",
    description: "Powerful wallet for the Stellar network."
  }
];

export function WalletModal({ isOpen, onClose, onSelectWallet }: WalletModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-charcoal-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl pointer-events-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-2xl font-bold text-gold-500">Connect Wallet</h3>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/5 text-foreground/70 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3">
                {WALLETS.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => onSelectWallet(wallet.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-charcoal-800 hover:bg-white/5 hover:border-gold-500/30 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-full bg-charcoal-900 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {wallet.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">{wallet.name}</h4>
                      <p className="text-sm text-foreground/50">{wallet.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-xs text-foreground/40 font-mono">
                  Powered by Stellar Wallets Kit
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
