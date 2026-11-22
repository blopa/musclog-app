import { Platform } from 'react-native';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

import { reportPremiumFailure } from '@/services/premium/premiumTelemetry';
import { RC_ID_PATTERN } from '@/utils/premium/deviceKeyCrypto';
import { summarizeCustomerInfo, summarizePurchase } from '@/utils/premium/harnessResult';

// The SDK is imported lazily, inside the functions, so it can never initialise at boot.
const NOT_CONFIGURED = 'RevenueCat is not configured: call configure first';

/** RevenueCat's store error codes the app tells apart. */
export const STORE_CANCELLED = '1';
export const STORE_NETWORK_ERROR = '10';
export const STORE_ALREADY_PURCHASED = '6';

let configuredAppUserId: string | null = null;
let sdkConfigured = false;

export function revenueCatApiKey(): string | null {
  let key: string | undefined;

  if (Platform.OS === 'ios') {
    key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  } else if (Platform.OS === 'android') {
    key = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  }

  return key ? key : null;
}

export function getConfiguredAppUserId(): string | null {
  return configuredAppUserId;
}

export function purchasesSdk() {
  // Inline require keeps the SDK lazy under Metro and Jest alike.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: typeof import('react-native-purchases') = require('react-native-purchases');

  return mod.default;
}

export function requireConfigured(): void {
  if (!sdkConfigured || configuredAppUserId === null) {
    throw new Error(NOT_CONFIGURED);
  }
}

/** The store error code of a thrown RevenueCat error, or `undefined` when it carries none. */
export function storeErrorCodeOf(e: unknown): string | undefined {
  const code = (e as { code?: unknown } | null)?.code;

  return code === undefined || code === null ? undefined : String(code);
}

/** The monthly package: the current offering's, else the first MONTHLY package of any offering. */
export function findMonthlyPackage(offerings: PurchasesOfferings): PurchasesPackage | null {
  const current = offerings.current?.monthly ?? null;

  if (current) {
    return current;
  }

  for (const offering of Object.values(offerings.all ?? {})) {
    const pkg = offering.availablePackages.find((p) => p.packageType === 'MONTHLY');

    if (pkg) {
      return pkg;
    }
  }

  return null;
}

export async function configureRevenueCat(
  rcId: string
): Promise<{ appUserID: string; alreadyConfigured: boolean; matchesRequested: boolean }> {
  if (!rcId || !RC_ID_PATTERN.test(rcId)) {
    throw new Error('RevenueCat id must match mlg1_ followed by 64 hex characters');
  }

  const apiKey = revenueCatApiKey();

  if (!apiKey) {
    throw new Error('RevenueCat API key is missing for this platform');
  }

  const Purchases = purchasesSdk();

  if (sdkConfigured) {
    const current = await Purchases.getAppUserID();

    return { appUserID: current, alreadyConfigured: true, matchesRequested: current === rcId };
  }

  try {
    const {
      LOG_LEVEL,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    }: typeof import('react-native-purchases') = require('react-native-purchases');

    if (LOG_LEVEL?.DEBUG) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
  } catch {
    // log level is best effort
  }

  Purchases.configure({ apiKey, appUserID: rcId });
  sdkConfigured = true;
  configuredAppUserId = rcId;

  return { appUserID: rcId, alreadyConfigured: false, matchesRequested: true };
}

/**
 * Makes RevenueCat act as `rcId`. Configures it first; when it was already configured under another
 * id (an earlier `logInTo` failed and was swallowed), logs in to `rcId`. A failure throws.
 */
export async function ensureRevenueCatIdentity(rcId: string): Promise<void> {
  const { matchesRequested } = await configureRevenueCat(rcId);

  if (!matchesRequested) {
    await logInTo(rcId);
  }
}

export async function buyMonthly(): Promise<ReturnType<typeof summarizePurchase>> {
  requireConfigured();

  const Purchases = purchasesSdk();
  const offerings = await Purchases.getOfferings();
  const pkg = findMonthlyPackage(offerings);

  if (!pkg) {
    const found = Object.values(offerings.all ?? {})
      .map(
        (o) =>
          `${o.identifier}: [${o.availablePackages.map((p) => `${p.identifier}/${p.packageType}`).join(', ')}]`
      )
      .join('; ');

    throw new Error(`No monthly package found. Offerings: ${found || 'none'}`);
  }

  return summarizePurchase(await Purchases.purchasePackage(pkg));
}

export async function restorePurchases(): Promise<ReturnType<typeof summarizeCustomerInfo>> {
  requireConfigured();

  const Purchases = purchasesSdk();

  return summarizeCustomerInfo(await Purchases.restorePurchases());
}

export async function logInTo(
  appUserId: string
): Promise<{ created: boolean; customerInfo: ReturnType<typeof summarizeCustomerInfo> }> {
  requireConfigured();

  const id = appUserId.trim();

  if (!id) {
    throw new Error('App user id is empty');
  }

  const Purchases = purchasesSdk();
  const result = await Purchases.logIn(id);

  configuredAppUserId = id;

  return { created: result.created, customerInfo: summarizeCustomerInfo(result.customerInfo) };
}

/**
 * The localized price of the monthly package, for the subscribe button. Configures the SDK under
 * the given key-derived id first (never anonymous); any failure is null, never a thrown error.
 */
/** How long the paywall waits for the store's price before it shows the screen without one. */
export const PRICE_LOOKUP_TIMEOUT_MS = 15_000;

/** Rejects with RevenueCat's network code when `work` takes longer than `ms`. */
function withStoreTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error('store timed out'), { code: STORE_NETWORK_ERROR })),
      ms
    );
  });

  return Promise.race([work, timedOut]).finally(() => clearTimeout(timer));
}

export async function getMonthlyPriceString(rcId: string): Promise<string | null> {
  try {
    // The whole Premium overview waits for this: a store that never answers must not leave the
    // screen on "Checking…" forever. A timeout reads as a dropped connection (not reported).
    const pkg = await withStoreTimeout(
      (async () => {
        await ensureRevenueCatIdentity(rcId);

        return findMonthlyPackage(await purchasesSdk().getOfferings());
      })(),
      PRICE_LOOKUP_TIMEOUT_MS
    );

    return pkg?.product.priceString ?? null;
  } catch (e) {
    const code = storeErrorCodeOf(e);

    // RevenueCat's NETWORK_ERROR (10) is a dropped connection, not a fault: no subscribe price
    // is shown and the next open retries, so it is not reported.
    reportPremiumFailure('price', code === STORE_NETWORK_ERROR ? 'network' : 'unknown', {
      storeErrorCode: code ?? 'none',
    });

    return null;
  }
}
