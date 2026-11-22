// Orchestration for the Premium screens. Everything underneath is mocked: the test pins which
// calls happen when (nothing at import, price only when not subscribed, usage only when subscribed,
// a removed subscription switches hosted AI off).
const mockSet = jest.fn(async (..._args: unknown[]) => undefined);
const mockGet = jest.fn(async (..._args: unknown[]): Promise<unknown> => null);

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    set: (...args: unknown[]) => mockSet(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));
jest.mock('@/services/premium/premiumService', () => ({
  fetchPremiumConfig: jest.fn(),
  getPremiumStatus: jest.fn(),
  purchaseAndEnroll: jest.fn(),
  refreshPremiumUsage: jest.fn(),
  resetPremium: jest.fn(async () => ({ rcId: 'x', revenueCatSwitched: false })),
  restoreAndEnroll: jest.fn(),
}));
jest.mock('@/services/premium/revenueCat', () => ({
  getMonthlyPriceString: jest.fn(async () => '€2.99'),
}));
jest.mock('@/services/premium/deviceKeyStore', () => ({
  getOrCreateDeviceKey: jest.fn(async () => ({ rcId: `mlg1_${'a'.repeat(64)}` })),
  loadDeviceKeyInfo: jest.fn(async () => ({ rcId: `mlg1_${'a'.repeat(64)}` })),
}));

import { SETTINGS } from '@/constants/settingDefinitions';
import * as premiumService from '@/services/premium/premiumService';
import * as harness from '@/services/premium/revenueCat';
import * as actions from '@/services/premium/premiumActions';
import * as deviceKeyStore from '@/services/premium/deviceKeyStore';
import { PREMIUM_CONSENT_VERSION } from '@/utils/premium/premiumConsent';

const service = jest.mocked(premiumService);
const RC = jest.mocked(harness);

const OPEN = {
  enabled: true,
  acceptingNew: true,
  visionEnabled: false,
  image: null,
  minAppVersion: null,
};
const USAGE = {
  usedPct: 10,
  resetsAt: '2026-12-01T00:00:00Z',
  status: 'active' as const,
  devices: { count: 1, max: 3 },
};

beforeEach(() => {
  jest.clearAllMocks();
  service.fetchPremiumConfig.mockResolvedValue({ ok: true, value: OPEN });
  service.refreshPremiumUsage.mockResolvedValue({ ok: true, value: USAGE });
  mockGet.mockResolvedValue(null);
});

describe('premiumActions', () => {
  it('calls nothing at import', () => {
    expect(service.getPremiumStatus).not.toHaveBeenCalled();
    expect(service.fetchPremiumConfig).not.toHaveBeenCalled();
    expect(RC.getMonthlyPriceString).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('reads the price only when not subscribed and config accepts', async () => {
    service.getPremiumStatus.mockResolvedValue('not_enrolled');
    const out = await actions.loadPremiumOverview();

    expect(out.priceString).toBe('€2.99');
    expect(RC.getMonthlyPriceString).toHaveBeenCalledWith(`mlg1_${'a'.repeat(64)}`);
    expect(service.refreshPremiumUsage).not.toHaveBeenCalled();
  });

  it('does not read the price when the config is not accepting new subscribers', async () => {
    service.getPremiumStatus.mockResolvedValue('not_enrolled');
    service.fetchPremiumConfig.mockResolvedValue({
      ok: true,
      value: { ...OPEN, acceptingNew: false },
    });
    const out = await actions.loadPremiumOverview();

    expect(out.priceString).toBeNull();
    expect(RC.getMonthlyPriceString).not.toHaveBeenCalled();
  });

  it('creates the device key to fetch the price for a device that never enrolled', async () => {
    service.getPremiumStatus.mockResolvedValue('not_enrolled');
    const out = await actions.loadPremiumOverview();

    expect(deviceKeyStore.getOrCreateDeviceKey).toHaveBeenCalled();
    expect(out.priceString).toBe('€2.99');
    expect(RC.getMonthlyPriceString).toHaveBeenCalledWith(`mlg1_${'a'.repeat(64)}`);
  });

  it('reads usage only when subscribed, and never the price', async () => {
    service.getPremiumStatus.mockResolvedValue('active');
    const out = await actions.loadPremiumOverview();

    expect(out.usage).toEqual(USAGE);
    expect(out.priceString).toBeNull();
    expect(RC.getMonthlyPriceString).not.toHaveBeenCalled();
  });

  it('shows revoked in the same call when the usage call finds the subscription lapsed', async () => {
    service.getPremiumStatus.mockResolvedValueOnce('active').mockResolvedValueOnce('revoked');
    service.refreshPremiumUsage.mockResolvedValue({ ok: false, failure: 'subscription_required' });

    const out = await actions.loadPremiumOverview();

    expect(out.status).toBe('revoked');
    expect(out.usage).toBeNull();
    expect(service.getPremiumStatus).toHaveBeenCalledTimes(2);
  });

  it('shows exhausted in the same call when the usage body says so', async () => {
    service.getPremiumStatus.mockResolvedValueOnce('active').mockResolvedValueOnce('exhausted');
    service.refreshPremiumUsage.mockResolvedValue({
      ok: true,
      value: { ...USAGE, status: 'exhausted' as never, usedPct: 100 },
    });

    const out = await actions.loadPremiumOverview();

    expect(out.status).toBe('exhausted');
    expect(out.usage?.usedPct).toBe(100);
  });

  it('reads the price in the same call when the subscription lapsed and the config accepts', async () => {
    service.getPremiumStatus.mockResolvedValueOnce('active').mockResolvedValueOnce('revoked');
    service.refreshPremiumUsage.mockResolvedValue({ ok: false, failure: 'subscription_required' });

    const out = await actions.loadPremiumOverview();

    expect(out.priceString).toBe('€2.99');
  });

  it('keeps a config failure as the failure, not a thrown error', async () => {
    service.getPremiumStatus.mockResolvedValue('not_enrolled');
    service.fetchPremiumConfig.mockResolvedValue({ ok: false, failure: 'network' });
    const out = await actions.loadPremiumOverview();

    expect(out.config).toBeNull();
    expect(out.configFailure).toBe('network');
  });

  it('resetPremiumOnThisDevice resets and switches hosted AI off', async () => {
    await actions.resetPremiumOnThisDevice();

    expect(service.resetPremium).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(SETTINGS.useHostedAi, false);
  });

  it('a removed or revoked subscription switches hosted AI off', async () => {
    await expect(actions.disableHostedIfRemoved('removed')).resolves.toBe(true);
    await expect(actions.disableHostedIfRemoved('revoked')).resolves.toBe(true);
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledWith(SETTINGS.useHostedAi, false);
  });

  it('leaves the setting alone for every other status', async () => {
    await expect(actions.disableHostedIfRemoved('active')).resolves.toBe(false);
    await expect(actions.disableHostedIfRemoved('not_enrolled')).resolves.toBe(false);
    await expect(actions.disableHostedIfRemoved('exhausted')).resolves.toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('subscribeToPremium and restorePremiumAccess', () => {
  const GRANT = { token: 't', expiresAt: '2026-12-01T00:00:00Z' };
  const onProgress = jest.fn();

  it('turns hosted AI on after a purchase when consent for the current version is stored', async () => {
    mockGet.mockResolvedValue(PREMIUM_CONSENT_VERSION);
    service.purchaseAndEnroll.mockResolvedValue({ ok: true, value: GRANT as never });

    await expect(actions.subscribeToPremium(onProgress)).resolves.toEqual({
      ok: true,
      value: GRANT,
    });
    expect(mockSet).toHaveBeenCalledWith(SETTINGS.useHostedAi, true);
  });

  it('leaves hosted AI off after a purchase when consent is not stored', async () => {
    mockGet.mockResolvedValue(null);
    service.purchaseAndEnroll.mockResolvedValue({ ok: true, value: GRANT as never });

    await actions.subscribeToPremium(onProgress);
    expect(mockSet).not.toHaveBeenCalledWith(SETTINGS.useHostedAi, true);
  });

  it('does neither when the purchase fails', async () => {
    mockGet.mockResolvedValue(PREMIUM_CONSENT_VERSION);
    service.purchaseAndEnroll.mockResolvedValue({
      ok: false,
      failure: 'purchase_cancelled',
    } as never);

    await expect(actions.subscribeToPremium(onProgress)).resolves.toEqual({
      ok: false,
      failure: 'purchase_cancelled',
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('restores with the same consent rule', async () => {
    mockGet.mockResolvedValue(PREMIUM_CONSENT_VERSION);
    service.restoreAndEnroll.mockResolvedValue({ ok: true, value: GRANT as never });

    await actions.restorePremiumAccess(onProgress);
    expect(mockSet).toHaveBeenCalledWith(SETTINGS.useHostedAi, true);
  });
});
