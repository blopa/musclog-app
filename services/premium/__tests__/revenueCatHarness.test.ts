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

const platform = { OS: 'ios' };

jest.mock('react-native', () => ({ Platform: platform }));

type Harness = typeof import('../revenueCatHarness');

function load(): Harness {
  let mod!: Harness;

  jest.isolateModules(() => {
    mod = require('../revenueCatHarness');
  });

  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  platform.OS = 'ios';
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios-key';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'android-key';
});

describe('revenueCatHarness', () => {
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

  it('has no logOut path', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'revenueCatHarness.ts'), 'utf8');

    expect(src).not.toContain('logOut');
  });
});
