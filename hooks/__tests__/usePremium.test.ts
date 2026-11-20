/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const mockFlag = jest.fn(() => false);
jest.mock('@/utils/premium/premiumUiFlag', () => ({ isPremiumUiEnabled: () => mockFlag() }));

const mockSettingsGet = jest.fn();
const mockSettingsSet = jest.fn(async () => undefined);
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
  subscribe: (...args: unknown[]) => mockActions.subscribe(...args),
  restore: (...args: unknown[]) => mockActions.restore(...args),
  setUseHostedAi: (...args: unknown[]) => mockActions.setUseHostedAi(...args),
  resetPremiumOnThisDevice: (...args: unknown[]) => mockActions.resetPremiumOnThisDevice(...args),
  disableHostedIfRemoved: (...args: unknown[]) => mockActions.disableHostedIfRemoved(...args),
}));

import { PREMIUM_FIXTURE_STATES } from '@/components/premium/premiumFixtureStates';
import { PremiumFixtureContext, usePremium } from '@/hooks/usePremium';

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
  mockFlag.mockReturnValue(true);
  mockSettingsGet.mockImplementation(async (setting: { type: string }) =>
    setting.type === 'premium_consent_version' ? null : false
  );
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
    expect(mockSettingsGet).not.toHaveBeenCalled();

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

  it('switches the hosted setting on and off through the actions', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.setUseHostedAi(true);
    });
    expect(mockActions.setUseHostedAi).toHaveBeenCalledWith(true);
    expect(result.current.useHostedAi).toBe(true);
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
    expect(result.current.consentNeeded(true)).toBe(false);
  });

  it('reset clears hosted AI and reloads', async () => {
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('not_subscribed'));
    await act(async () => {
      await result.current.reset();
    });
    expect(mockActions.resetPremiumOnThisDevice).toHaveBeenCalled();
    expect(result.current.useHostedAi).toBe(false);
  });

  it('turns hosted AI off when the overview says the subscription was removed', async () => {
    mockActions.loadPremiumOverview.mockResolvedValue({ ...OVERVIEW, status: 'removed' });
    mockActions.disableHostedIfRemoved.mockResolvedValue(true);
    mockSettingsGet.mockImplementation(async (setting: { type: string }) =>
      setting.type === 'use_hosted_ai' ? true : null
    );
    const { result } = renderHook(() => usePremium());

    await waitFor(() => expect(result.current.view.phase).toBe('removed'));
    expect(mockActions.disableHostedIfRemoved).toHaveBeenCalledWith('removed');
    expect(result.current.useHostedAi).toBe(false);
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
