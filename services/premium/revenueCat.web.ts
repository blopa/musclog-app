import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

const UNAVAILABLE = 'RevenueCat is not available on web';

export const STORE_CANCELLED = '1';
export const STORE_NETWORK_ERROR = '10';
export const STORE_ALREADY_PURCHASED = '6';

export function revenueCatApiKey(): string | null {
  return null;
}

export function getConfiguredAppUserId(): string | null {
  return null;
}

export function purchasesSdk(): never {
  throw new Error(UNAVAILABLE);
}

export function requireConfigured(): void {
  throw new Error(UNAVAILABLE);
}

export function storeErrorCodeOf(e: unknown): string | undefined {
  const code = (e as { code?: unknown } | null)?.code;

  return code === undefined || code === null ? undefined : String(code);
}

export function findMonthlyPackage(_offerings: PurchasesOfferings): PurchasesPackage | null {
  return null;
}

export async function configureRevenueCat(
  _rcId: string
): Promise<{ appUserID: string; alreadyConfigured: boolean; matchesRequested: boolean }> {
  throw new Error(UNAVAILABLE);
}

export async function ensureRevenueCatIdentity(_rcId: string): Promise<void> {
  throw new Error(UNAVAILABLE);
}

export async function buyMonthly(): Promise<never> {
  throw new Error(UNAVAILABLE);
}

export async function restorePurchases(): Promise<never> {
  throw new Error(UNAVAILABLE);
}

export async function logInTo(_appUserId: string): Promise<never> {
  throw new Error(UNAVAILABLE);
}

export async function getMonthlyPriceString(_rcId: string): Promise<string | null> {
  return null;
}
