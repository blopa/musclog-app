import * as fs from 'fs';
import * as path from 'path';

const RC_ID = `mlg1_${'a'.repeat(64)}`;

const purchases = {
  configure: jest.fn(),
  setLogLevel: jest.fn(async () => undefined),
  getAppUserID: jest.fn(async () => RC_ID),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  syncPurchases: jest.fn(),
  logIn: jest.fn(),
  getCustomerInfo: jest.fn(),
};
const mockFactory = jest.fn(() => ({
  __esModule: true,
  default: purchases,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

jest.mock('react-native-purchases', () => mockFactory());

jest.mock('@/services/premium/premiumTelemetry', () => ({
  reportPremiumFailure: jest.fn(),
}));

const platform = { OS: 'ios' };

jest.mock('react-native', () => ({ Platform: platform }));

type Harness = typeof import('../revenueCat');

function load(): Harness {
  let mod!: Harness;

  jest.isolateModules(() => {
    mod = require('../revenueCat');
  });

  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  platform.OS = 'ios';
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios-key';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'android-key';
});

describe('revenueCat', () => {
  it('does not touch the SDK on import', () => {
    load();

    expect(mockFactory).not.toHaveBeenCalled();
    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it('reads the API key per platform', () => {
    const h = load();

    expect(h.revenueCatApiKey()).toBe('ios-key');
    platform.OS = 'android';
    expect(h.revenueCatApiKey()).toBe('android-key');
    platform.OS = 'web';
    expect(h.revenueCatApiKey()).toBeNull();
    platform.OS = 'ios';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = '';
    expect(h.revenueCatApiKey()).toBeNull();
  });

  it('refuses a bad id or a missing key without configuring', async () => {
    const h = load();

    await expect(h.configureRevenueCat('')).rejects.toThrow();
    await expect(h.configureRevenueCat('anon')).rejects.toThrow();
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = '';
    await expect(h.configureRevenueCat(RC_ID)).rejects.toThrow(/key/);
    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it('configures once with the appUserID', async () => {
    const h = load();

    await h.configureRevenueCat(RC_ID);
    const second = await h.configureRevenueCat(RC_ID);

    expect(purchases.configure).toHaveBeenCalledTimes(1);
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: 'ios-key', appUserID: RC_ID });
    expect(second.alreadyConfigured).toBe(true);
    expect(second.matchesRequested).toBe(true);
    expect(h.getConfiguredAppUserId()).toBe(RC_ID);
  });

  it('ensureRevenueCatIdentity logs in when the SDK was configured under another id', async () => {
    const h = load();
    const OTHER = `mlg1_${'b'.repeat(64)}`;

    await h.configureRevenueCat(OTHER);
    purchases.getAppUserID.mockResolvedValueOnce(OTHER);
    purchases.logIn.mockResolvedValue({ created: false, customerInfo: {} });

    await h.ensureRevenueCatIdentity(RC_ID);

    expect(purchases.logIn).toHaveBeenCalledWith(RC_ID);
    expect(h.getConfiguredAppUserId()).toBe(RC_ID);
  });

  it('ensureRevenueCatIdentity does not log in when the id already matches', async () => {
    const h = load();

    await h.configureRevenueCat(RC_ID);
    purchases.logIn.mockClear();
    await h.ensureRevenueCatIdentity(RC_ID);

    expect(purchases.logIn).not.toHaveBeenCalled();
  });

  it('ensureRevenueCatIdentity lets a failed log-in throw', async () => {
    const h = load();
    const OTHER = `mlg1_${'b'.repeat(64)}`;

    await h.configureRevenueCat(OTHER);
    purchases.getAppUserID.mockResolvedValueOnce(OTHER);
    purchases.logIn.mockRejectedValueOnce(new Error('offline'));

    await expect(h.ensureRevenueCatIdentity(RC_ID)).rejects.toThrow('offline');
  });

  it('buyMonthly refuses before configure and picks current.monthly', async () => {
    const h = load();

    await expect(h.buyMonthly()).rejects.toThrow(/not configured/);
    expect(purchases.getOfferings).not.toHaveBeenCalled();

    const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY' };

    purchases.getOfferings.mockResolvedValue({
      current: { monthly, availablePackages: [] },
      all: {},
    });
    purchases.purchasePackage.mockResolvedValue({
      productIdentifier: 'p',
      transaction: { transactionIdentifier: 'tx' },
      customerInfo: {},
    });
    await h.configureRevenueCat(RC_ID);
    const result = await h.buyMonthly();

    expect(purchases.purchasePackage).toHaveBeenCalledWith(monthly);
    expect(result.transactionIdentifier).toBe('tx');
  });

  it('logInTo passes any trimmed id through and tracks it', async () => {
    const h = load();

    purchases.logIn.mockResolvedValue({ created: false, customerInfo: {} });
    await expect(h.logInTo('x')).rejects.toThrow(/not configured/);
    await h.configureRevenueCat(RC_ID);
    const out = await h.logInTo('  $RCAnonymousID:abc  ');

    expect(purchases.logIn).toHaveBeenCalledWith('$RCAnonymousID:abc');
    expect(out.created).toBe(false);
    expect(h.getConfiguredAppUserId()).toBe('$RCAnonymousID:abc');
  });

  it('getMonthlyPriceString configures under the id and reads the monthly price', async () => {
    const h = load();
    const monthly = {
      identifier: '$rc_monthly',
      packageType: 'MONTHLY',
      product: { priceString: '€2.99' },
    };

    purchases.getOfferings.mockResolvedValue({
      current: { monthly, availablePackages: [] },
      all: {},
    });
    await expect(h.getMonthlyPriceString(RC_ID)).resolves.toBe('€2.99');
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: 'ios-key', appUserID: RC_ID });
  });

  it('getMonthlyPriceString falls back to a MONTHLY package in any offering', async () => {
    const h = load();
    const found = { identifier: 'm', packageType: 'MONTHLY', product: { priceString: '$3.49' } };

    purchases.getOfferings.mockResolvedValue({
      current: null,
      all: {
        other: {
          availablePackages: [
            { identifier: 'a', packageType: 'ANNUAL', product: { priceString: '$30' } },
            found,
          ],
        },
      },
    });
    await expect(h.getMonthlyPriceString(RC_ID)).resolves.toBe('$3.49');
  });

  it('getMonthlyPriceString is null, never a throw, for an anonymous id or no package', async () => {
    const h = load();

    await expect(h.getMonthlyPriceString('anon')).resolves.toBeNull();
    expect(purchases.configure).not.toHaveBeenCalled();
    purchases.getOfferings.mockResolvedValue({ current: null, all: {} });
    await expect(h.getMonthlyPriceString(RC_ID)).resolves.toBeNull();
    purchases.getOfferings.mockRejectedValue(new Error('offline'));
    await expect(h.getMonthlyPriceString(RC_ID)).resolves.toBeNull();
  });

  it('has no logOut path', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'revenueCat.ts'), 'utf8');

    expect(src).not.toContain('logOut');
  });
});
