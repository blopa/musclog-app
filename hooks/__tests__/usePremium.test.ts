/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const mockFlag = jest.fn(() => false);
jest.mock('@/utils/premium/premiumUiFlag', () => ({ isPremiumUiEnabled: () => mockFlag() }));

let mockSettingsState: { useHostedAi: boolean; premiumConsentVersion: number | null } = {
  useHostedAi: false,
  premiumConsentVersion: null,
};
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => mockSettingsState }));

const mockSettingsGet = jest.fn(async (..._args: unknown[]): Promise<unknown> => null);
const mockSettingsSet = jest.fn(async (..._args: unknown[]): Promise<unknown> => undefined);
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: (...args: unknown[]) => mockSettingsGet(...args),
    set: (...args: unknown[]) => mockSettingsSet(...args),
  },
}));

const mockActions = {
  loadPremiumOverview: jest.fn(),
  subscribe: jest.fn(),
  restore: jest.fn(),
  setUseHostedAi: jest.fn(async () => undefined),
  resetPremiumOnThisDevice: jest.fn(async () => undefined),
  disableHostedIfRemoved: jest.fn(async () => false),
};
jest.mock('@/services/premium/premiumActions', () => ({
  loadPremiumOverview: (...args: unknown[]) => mockActions.loadPremiumOverview(...args),
  resetPremiumOnThisDevice: (...args: unknown[]) => mockActions.resetPremiumOnThisDevice(...args),
  disableHostedIfRemoved: (...args: unknown[]) => mockActions.disableHostedIfRemoved(...args),
}));

jest.mock('@/services/premium/premiumService', () => ({
  purchaseAndEnroll: (...args: unknown[]) => mockActions.subscribe(...args),
  restoreAndEnroll: (...args: unknown[]) => mockActions.restore(...args),
}));

import { PREMIUM_FIXTURE_STATES } from '@/components/premium/premiumFixtureStates';
import { SETTINGS } from '@/constants/settingDefinitions';
import { PREMIUM_CONSENT_VERSION } from '@/utils/premium/premiumConsent';
import { PremiumFixtureContext, usePremium } from '@/hooks/usePremium';
import {
  getPremiumActivity,
  getPremiumConsentPending,
  resetPremiumActivity,
  takeUnseenPremiumFailure,
} from '@/utils/premium/premiumActivity';

const OVERVIEW = {
  status: 'no_key',
  usage: null,
  config: {
    enabled: true,
    acceptingNew: true,
    visionEnabled: false,
    image: null,
    minAppVersion: null,
  },
  configFailure: null,
  priceString: '€2.99',
};

beforeEach(() => {
  jest.clearAllMocks();
  resetPremiumActivity();
  mockFlag.mockReturnValue(true);
  mockSettingsState = { useHostedAi: false, premiumConsentVersion: null };
  mockSettingsGet.mockResolvedValue(null);
  mockActions.loadPremiumOverview.mockResolvedValue(OVERVIEW);
  mockActions.subscribe.mockResolvedValue({ ok: true, value: {} });
  mockActions.restore.mockResolvedValue({ ok: false, failure: 'restore_failed' });
  mockActions.disableHostedIfRemoved.mockResolvedValue(false);
});

describe('usePremium', () => {
  it('does nothing when Premium is switched off in this build', async () => {
    mockFlag.mockReturnValue(false);
    const { result } = renderHook(() => usePremium());

    expect(result.current.enabled).toBe(false);
    expect(result.current.view.phase).toBe('loading');
    expect(result.current.priceString).toBeNull();
    expect(mockActions.loadPremiumOverview).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.subscribe();
    });
    expect(mockActions.subscribe).not.toHaveBeenCalled();
  });

  it('loads the overview once on mount and exposes the view and price', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    expect(mockActions.loadPremiumOverview).toHaveBeenCalledTimes(1);
    expect(result.current.view.canSubscribe).toBe(true);
    expect(result.current.priceString).toBe('€2.99');
  });

  it('subscribe returns true, reloads, and clears the last failure', async () => {
    mockActions.restore.mockResolvedValueOnce({ ok: false, failure: 'restore_failed' });
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.restore();
    });
    expect(result.current.view.notice).toBe('restore_nothing');

    let ok = false;

    await act(async () => {
      ok = await result.current.subscribe();
    });
    expect(ok).toBe(true);
    expect(result.current.view.notice).toBeNull();
    expect(mockActions.loadPremiumOverview).toHaveBeenCalledTimes(2);
  });

  it('switches hosted AI on after a restore when the consent is already on file', async () => {
    mockSettingsGet.mockResolvedValue(PREMIUM_CONSENT_VERSION);
    mockActions.restore.mockResolvedValueOnce({ ok: true, value: {} });
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.restore();
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(SETTINGS.useHostedAi, true);
  });

  it('leaves hosted AI off after a purchase when the consent is not on file yet', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.subscribe();
    });
    expect(mockSettingsSet).not.toHaveBeenCalledWith(SETTINGS.useHostedAi, true);
  });

  it('subscribe returns false and keeps the failure on a cancelled purchase', async () => {
    mockActions.subscribe.mockResolvedValue({ ok: false, failure: 'purchase_cancelled' });
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    let ok = true;

    await act(async () => {
      ok = await result.current.subscribe();
    });
    expect(ok).toBe(false);
    expect(result.current.view.notice).toBe('purchase_cancelled');
  });

  it('switches the hosted setting on and off in the settings', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.setUseHostedAi(true);
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'use_hosted_ai' }),
      true
    );
  });

  it('asks for consent when turning on, and records it once', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    expect(result.current.consentNeeded(true)).toBe(true);
    expect(result.current.consentNeeded(false)).toBe(false);

    await act(async () => {
      await result.current.recordConsent();
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'premium_consent_version' }),
      1
    );
    mockSettingsState = { ...mockSettingsState, premiumConsentVersion: 1 };
    const { result: after } = renderHook(() => usePremium());

    expect(after.current.consentNeeded(true)).toBe(false);
  });

  it('reset clears hosted AI and reloads', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.reset();
    });
    expect(mockActions.resetPremiumOnThisDevice).toHaveBeenCalled();
  });

  it('turns hosted AI off when the overview says the subscription was removed', async () => {
    mockActions.loadPremiumOverview.mockResolvedValue({ ...OVERVIEW, status: 'removed' });
    mockActions.disableHostedIfRemoved.mockResolvedValue(true);
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('removed'));
    expect(mockActions.disableHostedIfRemoved).toHaveBeenCalledWith('removed');
    expect(result.current.view.notice).toBe('removed');
  });
});

describe('usePremium fixture seam', () => {
  it('returns exactly the value a PremiumFixtureContext provider supplies', () => {
    const fixture = PREMIUM_FIXTURE_STATES[3].build();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PremiumFixtureContext.Provider, { value: fixture }, children);

    const { result } = renderHook(() => usePremium(), { wrapper });

    expect(result.current).toBe(fixture);
    expect(result.current.view.phase).toBe('exhausted');
  });
});

describe('usePremium busy tracking and closing mid-action', () => {
  it('exposes the stage the service reports and is busy until the call ends', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockActions.subscribe.mockImplementation(
      (onProgress: (stage: string) => void) =>
        new Promise((resolve) => {
          onProgress('store');
          finish = resolve;
        })
    );
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    let pending: Promise<boolean> = Promise.resolve(false);

    act(() => {
      pending = result.current.subscribe();
    });
    expect(result.current.busy).toBe(true);
    expect(result.current.activity).toEqual({ kind: 'subscribe', stage: 'store' });

    await act(async () => {
      finish({ ok: true, value: {} });
      await pending;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.activity).toBeNull();
  });

  it('keeps the action alive when the screen closes, and leaves the consent question pending', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockActions.subscribe.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const first = renderHook(() => usePremium());

    await waitFor(() => expect(first.result.current.view.phase).toBe('not_subscribed'));
    let pending: Promise<boolean> = Promise.resolve(false);

    act(() => {
      pending = first.result.current.subscribe();
    });
    first.unmount(); // the modal is closed while the purchase is in flight

    // Reopened: the same action is still shown as running.
    const second = renderHook(() => usePremium());
    expect(second.result.current.busy).toBe(true);
    expect(getPremiumActivity()?.kind).toBe('subscribe');

    // A second tap cannot start a second purchase.
    let again = true;
    await act(async () => {
      again = await second.result.current.subscribe();
    });
    expect(again).toBe(false);
    expect(mockActions.subscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ ok: true, value: {} });
      await pending;
    });
    expect(getPremiumActivity()).toBeNull();
    expect(getPremiumConsentPending()).toBe(true);
    expect(second.result.current.busy).toBe(false);
  });

  it('shows a failure that ended while the screen was closed when it opens again', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockActions.subscribe.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const first = renderHook(() => usePremium());

    await waitFor(() => expect(first.result.current.view.phase).toBe('not_subscribed'));
    let pending: Promise<boolean> = Promise.resolve(false);

    act(() => {
      pending = first.result.current.subscribe();
    });
    first.unmount();
    await act(async () => {
      finish({ ok: false, failure: 'purchase_failed' });
      await pending;
    });
    expect(getPremiumConsentPending()).toBe(false);

    const second = renderHook(() => usePremium());

    await waitFor(() => expect(second.result.current.view.notice).toBe('purchase_failed'));
    expect(takeUnseenPremiumFailure()).toBeNull();
  });

  it('reports reset and the AI switch as busy while they run', async () => {
    let release: () => void = () => undefined;
    mockActions.resetPremiumOnThisDevice.mockImplementation(
      () => new Promise<undefined>((resolve) => (release = () => resolve(undefined)))
    );
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    let pending: Promise<void> = Promise.resolve();

    act(() => {
      pending = result.current.reset();
    });
    expect(result.current.activity).toEqual({ kind: 'reset', stage: null });

    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.busy).toBe(false);

    await act(async () => {
      await result.current.setUseHostedAi(true);
    });
    expect(result.current.busy).toBe(false);
    expect(mockActions.loadPremiumOverview).toHaveBeenCalledTimes(2); // mount + reset, not the switch
  });
});
