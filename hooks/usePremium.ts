// The one hook the Premium screens use (plan 11 item 7). It only reads: the overview, the activity
// and the last failure live in module-level stores (`services/premium/premiumStore.ts`,
// `utils/premium/premiumActivity.ts`) that outlive every screen. When Premium is switched off in this
// build it does nothing: no service call, no subscription, and the view stays "loading".
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

import { useSettings } from '@/hooks/useSettings';
import { recordPremiumConsent } from '@/services/premium/premiumActions';
import {
  getPremiumOverview,
  refreshPremiumOverview,
  resetPremiumDevice,
  restorePremium,
  setUseHostedAi,
  subscribePremium,
  subscribePremiumOverview,
} from '@/services/premium/premiumStore';
import { getHostedSignal, subscribeHostedSignal } from '@/utils/premium/hostedSignal';
import {
  getPremiumActionFailure,
  getPremiumActivity,
  type PremiumActivity,
  subscribePremiumActivity,
} from '@/utils/premium/premiumActivity';
import { needsPremiumConsent } from '@/utils/premium/premiumConsent';
import { isPremiumUiEnabled } from '@/utils/premium/premiumUiFlag';
import { buildPremiumViewModel, type PremiumViewModel } from '@/utils/premium/premiumUiState';

export type UsePremium = {
  enabled: boolean;
  view: PremiumViewModel;
  priceString: string | null;
  busy: boolean;
  /** What is running (and its stage), from a store that outlives the screen; null when idle. */
  activity: PremiumActivity | null;
  useHostedAi: boolean;
  subscribe(): Promise<boolean>;
  restore(): Promise<boolean>;
  refresh(): Promise<void>;
  setUseHostedAi(on: boolean): Promise<void>;
  reset(): Promise<void>;
  consentNeeded(nextValue: boolean): boolean;
  recordConsent(): Promise<void>;
};

type PremiumActions = Pick<
  UsePremium,
  'subscribe' | 'restore' | 'refresh' | 'setUseHostedAi' | 'reset' | 'recordConsent'
>;

const LIVE_ACTIONS: PremiumActions = {
  subscribe: subscribePremium,
  restore: restorePremium,
  refresh: refreshPremiumOverview,
  setUseHostedAi,
  reset: async () => {
    await resetPremiumDevice();
  },
  recordConsent: recordPremiumConsent,
};

// Handed out while Premium is switched off: every action is a no-op, so no callback checks the flag.
const INERT_ACTIONS: PremiumActions = {
  subscribe: async () => false,
  restore: async () => false,
  refresh: async () => undefined,
  setUseHostedAi: async () => undefined,
  reset: async () => undefined,
  recordConsent: async () => undefined,
};

/**
 * Test-fixture seam only: `/app/test/modals` wraps `PremiumModal` in a provider so every Premium
 * state can be rendered with no service, no flag and no network. The default is null, so nothing
 * in the app ever sets it and `usePremium` behaves as before.
 */
export const PremiumFixtureContext = createContext<UsePremium | null>(null);

/**
 * `load` asks for the overview (one shared request, read again each time it turns on): only a screen
 * that shows it passes it, so a component that merely checks `enabled` costs no request.
 */
export function usePremium({ load = false }: { load?: boolean } = {}): UsePremium {
  const fixture = useContext(PremiumFixtureContext);
  const enabled = isPremiumUiEnabled();
  const overview = useSyncExternalStore(
    subscribePremiumOverview,
    getPremiumOverview,
    getPremiumOverview
  );
  const activity = useSyncExternalStore(
    subscribePremiumActivity,
    getPremiumActivity,
    getPremiumActivity
  );
  const lastActionFailure = useSyncExternalStore(
    subscribePremiumActivity,
    getPremiumActionFailure,
    getPremiumActionFailure
  );
  const signal = useSyncExternalStore(subscribeHostedSignal, getHostedSignal, getHostedSignal);
  const { useHostedAi, premiumConsentVersion: consentVersion } = useSettings();
  const busy = activity !== null;

  useEffect(() => {
    if (enabled && load) {
      refreshPremiumOverview();
    }
  }, [enabled, load]);

  const view = useMemo(
    () =>
      buildPremiumViewModel({
        status: enabled ? (overview?.status ?? null) : null,
        config: overview?.config ?? null,
        configFailure: overview?.configFailure ?? null,
        usage: overview?.usage ?? null,
        lastActionFailure,
        signal,
        busy,
      }),
    [enabled, overview, lastActionFailure, signal, busy]
  );

  const actions = enabled ? LIVE_ACTIONS : INERT_ACTIONS;
  const priceString = enabled ? (overview?.priceString ?? null) : null;

  // One stable object per change: a consumer that lists the hook's result in an effect's
  // dependencies must not re-run it on every render.
  const live = useMemo<UsePremium>(
    () => ({
      enabled,
      view,
      priceString,
      busy,
      activity,
      useHostedAi,
      ...actions,
      consentNeeded: (nextValue) =>
        needsPremiumConsent({
          storedVersion: consentVersion,
          nextValue,
        }),
    }),
    [enabled, view, priceString, busy, activity, useHostedAi, actions, consentVersion]
  );

  return fixture ?? live;
}
