// Orchestration for the Premium screens. Everything underneath is mocked: the test pins which
// calls happen when (nothing at import, price only when not subscribed, usage only when subscribed,
// a removed subscription switches hosted AI off).
const mockSet = jest.fn(async () => undefined);

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { set: (...args: unknown[]) => mockSet(...args) },
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
  loadDeviceKeyInfo: jest.fn(async () => ({ rcId: `mlg1_${'a'.repeat(64)}` })),
}));

import { SETTINGS } from '@/constants/settingDefinitions';
import * as premiumService from '@/services/premium/premiumService';
import * as harness from '@/services/premium/revenueCat';
import * as actions from '@/services/premium/premiumActions';

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
});

describe('premiumActions', () => {
  it('calls nothing at import', () => {
    expect(service.getPremiumStatus).not.toHaveBeenCalled();
    expect(service.fetchPremiumConfig).not.toHaveBeenCalled();
    expect(RC.getMonthlyPriceString).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('reads the price only when not subscribed and config accepts', async () => {
    service.getPremiumStatus.mockResolvedValue('no_key');
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

  it('reads usage only when subscribed, and never the price', async () => {
    service.getPremiumStatus.mockResolvedValue('active');
    const out = await actions.loadPremiumOverview();

    expect(out.usage).toEqual(USAGE);
    expect(out.priceString).toBeNull();
    expect(RC.getMonthlyPriceString).not.toHaveBeenCalled();
  });

  it('keeps a config failure as the failure, not a thrown error', async () => {
    service.getPremiumStatus.mockResolvedValue('no_key');
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
    await expect(actions.disableHostedIfRemoved('no_key')).resolves.toBe(false);
    await expect(actions.disableHostedIfRemoved('exhausted')).resolves.toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });
});
