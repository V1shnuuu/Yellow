let walletKit: any = null;

export async function getWalletKit() {
  if (typeof window === 'undefined') {
    throw new Error('Cannot initialize wallet kit on server');
  }
  
  if (!walletKit) {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
    
    StellarWalletsKit.init({
      network: "Test SDF Network ; September 2015" as any,
      selectedWalletId: "freighter",
      modules: defaultModules()
    });
    walletKit = StellarWalletsKit;
  }
  
  return walletKit;
}
