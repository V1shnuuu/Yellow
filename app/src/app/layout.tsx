import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "ChronoBid | Live Soroban Auctions",
  description: "Live bidding, settled on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans`}
      >
        <div className="min-h-screen bg-charcoal-800 text-foreground selection:bg-gold-500/30">
          <header className="border-b border-white/5 bg-charcoal-900/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-gold-500">
                ChronoBid.
              </h1>
              <div id="wallet-button-portal"></div>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-12">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
