// The module-level Premium store: one shared overview request, the action runner that reloads the
// overview after a success, and the failure it keeps for the next screen. Everything under it is mocked.
const mockLoad = jest.fn();
const mockDisable = jest.fn(async (_status: string) => false);

jest.mock('@/services/premium/premiumActions', () => ({
  loadPremiumOverview: (...args: unknown[]) => mockLoad(...args),
  disableHostedIfRemoved: (status: string) => mockDisable(status),
  resetPremiumOnThisDevice: jest.fn(async () => undefined),
  restorePremiumAccess: jest.fn(),
  subscribeToPremium: jest.fn(),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { set: jest.fn(async () => undefined) },
}));

import {
  getPremiumOverview,
  refreshPremiumOverview,
  resetPremiumStore,
  runPremiumAction,
  setUseHostedAi,
  subscribePremiumOverview,
} from '@/services/premium/premiumStore';
import {
  getPremiumActionFailure,
  getPremiumActivity,
  resetPremiumActivity,
} from '@/utils/premium/premiumActivity';

const OVERVIEW = {
  status: 'active',
  usage: null,
  config: null,
  configFailure: null,
  priceString: null,
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => (resolve = r));

  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPremiumStore();
  resetPremiumActivity();
  mockLoad.mockResolvedValue(OVERVIEW);
  mockDisable.mockResolvedValue(false);
});

describe('refreshPremiumOverview', () => {
  it('shares one loadPremiumOverview call between concurrent callers', async () => {
    const pending = deferred<typeof OVERVIEW>();
    mockLoad.mockReturnValue(pending.promise);

    const first = refreshPremiumOverview();
    const second = refreshPremiumOverview();

    expect(first).toBe(second);
    pending.resolve(OVERVIEW);
    await Promise.all([first, second]);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('publishes the overview to subscribers and to getPremiumOverview', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribePremiumOverview(listener);

    await refreshPremiumOverview();

    expect(getPremiumOverview()).toEqual(OVERVIEW);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('switches hosted AI off when the subscription is removed or revoked', async () => {
    mockLoad.mockResolvedValue({ ...OVERVIEW, status: 'removed' });

    await refreshPremiumOverview();

    expect(mockDisable).toHaveBeenCalledWith('removed');
  });

  it('does not throw when the load rejects, and asks again on the next call', async () => {
    mockLoad.mockRejectedValueOnce(new Error('network'));

    await expect(refreshPremiumOverview()).resolves.toBeUndefined();
    expect(getPremiumOverview()).toBeNull();

    mockLoad.mockResolvedValueOnce(OVERVIEW);
    await refreshPremiumOverview();
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(getPremiumOverview()).toEqual(OVERVIEW);
  });
});

describe('runPremiumAction', () => {
  it('returns true and reloads the overview after a success', async () => {
    const ok = await runPremiumAction('subscribe', async () => ({ ok: true }));

    expect(ok).toBe(true);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(getPremiumActionFailure()).toBeNull();
  });

  it('does not reload the overview with { reload: false }', async () => {
    const ok = await runPremiumAction('toggle', async () => ({ ok: true }), { reload: false });

    expect(ok).toBe(true);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('returns false and stores the failure when the result failed', async () => {
    const ok = await runPremiumAction('restore', async () => ({
      ok: false,
      failure: 'restore_nothing' as never,
    }));

    expect(ok).toBe(false);
    expect(getPremiumActionFailure()).toBe('restore_nothing');
    expect(mockLoad).not.toHaveBeenCalled();
    expect(getPremiumActivity()).toBeNull();
  });

  it('ends the activity and returns false when the action throws', async () => {
    const ok = await runPremiumAction('subscribe', async () => {
      throw new Error('boom');
    }).catch((error: unknown) => error);

    expect(ok).toBeInstanceOf(Error);
    expect(getPremiumActivity()).toBeNull();
  });

  it('returns false without running when another action is already active', async () => {
    const pending = deferred<{ ok: true }>();
    const running = runPremiumAction('subscribe', () => pending.promise);
    const action = jest.fn(async () => ({ ok: true as const }));

    await expect(runPremiumAction('restore', action)).resolves.toBe(false);
    expect(action).not.toHaveBeenCalled();

    pending.resolve({ ok: true });
    await running;
  });
});

describe('setUseHostedAi', () => {
  it('runs as a toggle without reloading the overview', async () => {
    await setUseHostedAi(true);

    expect(mockLoad).not.toHaveBeenCalled();
    expect(getPremiumActivity()).toBeNull();
  });
});
