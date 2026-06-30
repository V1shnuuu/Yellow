import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

let isInitialized = false;

export function getWalletKit() {
  if (typeof window === 'undefined') {
    throw new Error('Cannot initialize wallet kit on server');
  }
  
  if (!isInitialized) {
    StellarWalletsKit.init({
      network: "Test SDF Network ; September 2015" as any,
      selectedWalletId: "freighter",
      modules: defaultModules()
    });
    isInitialized = true;
  }
  
  return StellarWalletsKit;
}
