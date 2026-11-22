// Web has no RevenueCat: the harness reads are unavailable and never touch the SDK.
const UNAVAILABLE = 'RevenueCat is not available on web';

export async function fetchOfferings(): Promise<unknown> {
  throw new Error(UNAVAILABLE);
}

export async function syncPurchases(): Promise<{ ok: true }> {
  throw new Error(UNAVAILABLE);
}

export async function getCustomerInfoDump(): Promise<never> {
  throw new Error(UNAVAILABLE);
}
