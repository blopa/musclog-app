// The one hook the Premium screens use (plan 11 item 7). When Premium is switched off in this build
// it does nothing: no service call, no subscription, and the view stays "loading".
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import {
  disableHostedIfRemoved,
  loadPremiumOverview,
  type PremiumOverview,
  resetPremiumOnThisDevice,
} from '@/services/premium/premiumActions';
import { purchaseAndEnroll, restoreAndEnroll } from '@/services/premium/premiumService';
import { getHostedSignal, subscribeHostedSignal } from '@/utils/premium/hostedSignal';
import {
  beginPremiumActivity,
  endPremiumActivity,
  getPremiumActivity,
  type PremiumActivity,
  type PremiumActivityKind,
  type PremiumProgress,
  reportPremiumProgress,
  subscribePremiumActivity,
  takeUnseenPremiumFailure,
} from '@/utils/premium/premiumActivity';
import { needsPremiumConsent, PREMIUM_CONSENT_VERSION } from '@/utils/premium/premiumConsent';
import type { PremiumActionFailure } from '@/utils/premium/premiumState';
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

/** What a Premium action reports: it went through, or it failed for a reason the screen shows. */
type ActionResult = { ok: true } | { ok: false; failure: PremiumActionFailure };

type PremiumActions = Pick<
  UsePremium,
  'subscribe' | 'restore' | 'refresh' | 'setUseHostedAi' | 'reset' | 'recordConsent'
>;

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

export function usePremium(): UsePremium {
  const fixture = useContext(PremiumFixtureContext);
  const enabled = isPremiumUiEnabled();
  const [overview, setOverview] = useState<PremiumOverview | null>(null);
  const [lastActionFailure, setLastActionFailure] = useState<PremiumActionFailure | null>(null);
  const activity = useSyncExternalStore(
    subscribePremiumActivity,
    getPremiumActivity,
    getPremiumActivity
  );
  const busy = activity !== null;
  const { useHostedAi, premiumConsentVersion: consentVersion } = useSettings();
  const mounted = useRef(true);
  const signal = useSyncExternalStore(subscribeHostedSignal, getHostedSignal, getHostedSignal);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // An action that failed while no screen was mounted: show its result now (after the effect,
    // so no state is set synchronously inside it).
    let cancelled = false;

    Promise.resolve().then(() => {
      const failure = cancelled ? null : takeUnseenPremiumFailure();

      if (failure) {
        setLastActionFailure(failure);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Setting state after unmount is a no-op, and a removed device must switch hosted AI off either way.
  const applyOverview = useCallback(async (next: PremiumOverview) => {
    setOverview(next);
    await disableHostedIfRemoved(next.status);
  }, []);

  const refresh = useCallback(async () => {
    await applyOverview(await loadPremiumOverview());
  }, [applyOverview]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    loadPremiumOverview()
      .then((next) => {
        if (!cancelled) {
          return applyOverview(next);
        }

        return undefined;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled, applyOverview]);

  // One action at a time, tracked in a store that outlives this hook: closing the screen neither
  // stops the service call nor loses its result (a finished purchase still asks for consent later).
  const runAction = useCallback(
    async (
      kind: PremiumActivityKind,
      action: (onProgress: (stage: PremiumProgress) => void) => Promise<ActionResult>,
      // Flipping the AI switch changes nothing the Worker reports: no reload, the notice stays.
      reloadAfter = true
    ) => {
      if (!beginPremiumActivity(kind)) {
        return false;
      }

      let outcome: Parameters<typeof endPremiumActivity>[1] = { ok: false, failure: null };

      try {
        const result = await action(reportPremiumProgress);

        if (result.ok) {
          outcome = { ok: true };

          if (mounted.current && reloadAfter) {
            setLastActionFailure(null);
            await refresh();
          }

          return true;
        }

        outcome = { ok: false, failure: result.failure };

        if (mounted.current) {
          setLastActionFailure(result.failure);
          takeUnseenPremiumFailure();
        }

        return false;
      } finally {
        endPremiumActivity(kind, outcome);
      }
    },
    [refresh]
  );

  const liveActions = useMemo<PremiumActions>(() => {
    // A purchase or restore only enrolls the device. When the consent for this version is already on
    // file (a reset keeps it) the switch has no question left to wait for, so it goes on here; without
    // the consent it stays off and PremiumModal asks. Read at call time, never from a render snapshot.
    const switchOnWhenConsented = async () => {
      const stored = await SettingsService.get(SETTINGS.premiumConsentVersion);

      if (!needsPremiumConsent(stored, false, true)) {
        await SettingsService.set(SETTINGS.useHostedAi, true);
      }
    };

    const enrollThenSwitchOn =
      (enroll: (onProgress: (stage: PremiumProgress) => void) => Promise<ActionResult>) =>
      async (onProgress: (stage: PremiumProgress) => void): Promise<ActionResult> => {
        const result = await enroll(onProgress);

        if (result.ok) {
          await switchOnWhenConsented().catch(() => undefined);
        }

        return result;
      };

    const subscribe = () => runAction('subscribe', enrollThenSwitchOn(purchaseAndEnroll));
    const restore = () => runAction('restore', enrollThenSwitchOn(restoreAndEnroll));

    const setUseHostedAi = async (on: boolean) => {
      await runAction(
        'toggle',
        async () => {
          await SettingsService.set(SETTINGS.useHostedAi, on);

          return { ok: true };
        },
        false
      );
    };

    const reset = async () => {
      await runAction('reset', async () => {
        await resetPremiumOnThisDevice();

        if (mounted.current) {
          setLastActionFailure(null);
        }

        return { ok: true };
      });
    };

    const recordConsent = async () => {
      await SettingsService.set(SETTINGS.premiumConsentVersion, PREMIUM_CONSENT_VERSION);
    };

    return { subscribe, restore, refresh, setUseHostedAi, reset, recordConsent };
  }, [runAction, refresh]);

  const consentNeeded = useCallback(
    (nextValue: boolean) => needsPremiumConsent(consentVersion, useHostedAi, nextValue),
    [consentVersion, useHostedAi]
  );

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

  const actions = enabled ? liveActions : INERT_ACTIONS;
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
      consentNeeded,
    }),
    [enabled, view, priceString, busy, activity, useHostedAi, actions, consentNeeded]
  );

  return fixture ?? live;
}
