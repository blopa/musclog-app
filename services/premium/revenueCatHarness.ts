import { Platform } from 'react-native';

import {
  summarizeCustomerInfo,
  summarizePurchase,
  toJsonSafe,
} from '@/utils/premium/harnessResult';

// The SDK is imported lazily, inside the functions, so it can never initialise at boot.
const RC_ID_PATTERN = /^mlg1_[0-9a-f]{64}$/;
const NOT_CONFIGURED = 'RevenueCat is not configured: call configure first';

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

function loadPurchases() {
  // Inline require keeps the SDK lazy under Metro and Jest alike.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: typeof import('react-native-purchases') = require('react-native-purchases');

  return mod.default;
}

function requireConfigured(): void {
  if (!sdkConfigured || configuredAppUserId === null) {
    throw new Error(NOT_CONFIGURED);
  }
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

  const Purchases = loadPurchases();

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

export async function fetchOfferings(): Promise<unknown> {
  requireConfigured();

  const Purchases = loadPurchases();
  const offerings = await Purchases.getOfferings();

  return toJsonSafe({
    currentOfferingId: offerings.current?.identifier ?? null,
    offerings: Object.values(offerings.all ?? {}).map((o) => ({
      identifier: o.identifier,
      packages: o.availablePackages.map((p) => ({
        identifier: p.identifier,
        packageType: p.packageType,
        productIdentifier: p.product.identifier,
        priceString: p.product.priceString,
        currency: p.product.currencyCode,
        price: p.product.price,
      })),
    })),
  });
}

export async function buyMonthly(): Promise<ReturnType<typeof summarizePurchase>> {
  requireConfigured();

  const Purchases = loadPurchases();
  const offerings = await Purchases.getOfferings();
  const all = Object.values(offerings.all ?? {});
  let pkg = offerings.current?.monthly ?? null;

  if (!pkg) {
    for (const offering of all) {
      pkg = offering.availablePackages.find((p) => p.packageType === 'MONTHLY') ?? null;

      if (pkg) {
        break;
      }
    }
  }

  if (!pkg) {
    const found = all
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

  const Purchases = loadPurchases();

  return summarizeCustomerInfo(await Purchases.restorePurchases());
}

export async function syncPurchases(): Promise<{ ok: true }> {
  requireConfigured();

  const Purchases = loadPurchases();

  await Purchases.syncPurchases();

  return { ok: true };
}

export async function logInTo(
  appUserId: string
): Promise<{ created: boolean; customerInfo: ReturnType<typeof summarizeCustomerInfo> }> {
  requireConfigured();

  const id = appUserId.trim();

  if (!id) {
    throw new Error('App user id is empty');
  }

  const Purchases = loadPurchases();
  const result = await Purchases.logIn(id);

  configuredAppUserId = id;

  return { created: result.created, customerInfo: summarizeCustomerInfo(result.customerInfo) };
}

export async function getCustomerInfoDump(): Promise<{
  summary: ReturnType<typeof summarizeCustomerInfo>;
  raw: unknown;
}> {
  requireConfigured();

  const Purchases = loadPurchases();
  const info = await Purchases.getCustomerInfo();

  return { summary: summarizeCustomerInfo(info), raw: toJsonSafe(info) };
}
