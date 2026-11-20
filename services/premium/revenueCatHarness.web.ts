const UNAVAILABLE = 'RevenueCat is not available on web';

export function revenueCatApiKey(): string | null {
  return null;
}

export function getConfiguredAppUserId(): string | null {
  return null;
}

export async function configureRevenueCat(
  _rcId: string
): Promise<{ appUserID: string; alreadyConfigured: boolean; matchesRequested: boolean }> {
  throw new Error(UNAVAILABLE);
}

export async function fetchOfferings(): Promise<unknown> {
  throw new Error(UNAVAILABLE);
}

export async function buyMonthly(): Promise<never> {
  throw new Error(UNAVAILABLE);
}

export async function restorePurchases(): Promise<never> {
  throw new Error(UNAVAILABLE);
}

export async function syncPurchases(): Promise<{ ok: true }> {
  throw new Error(UNAVAILABLE);
}

export async function logInTo(_appUserId: string): Promise<never> {
  throw new Error(UNAVAILABLE);
}

export async function getCustomerInfoDump(): Promise<never> {
  throw new Error(UNAVAILABLE);
}
