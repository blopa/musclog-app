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
import {
  disableHostedIfRemoved,
  loadPremiumOverview,
  type PremiumOverview,
  resetPremiumOnThisDevice,
  restore as restoreAction,
  setUseHostedAi as setUseHostedAiAction,
  subscribe as subscribeAction,
} from '@/services/premium/premiumActions';
import { getHostedSignal, subscribeHostedSignal } from '@/utils/premium/hostedSignal';
import { needsPremiumConsent, PREMIUM_CONSENT_VERSION } from '@/utils/premium/premiumConsent';
import type { PremiumActionFailure } from '@/utils/premium/premiumState';
import { isPremiumUiEnabled } from '@/utils/premium/premiumUiFlag';
import { buildPremiumViewModel, type PremiumViewModel } from '@/utils/premium/premiumUiState';

export type UsePremium = {
  enabled: boolean;
  view: PremiumViewModel;
  priceString: string | null;
  busy: boolean;
  useHostedAi: boolean;
  subscribe(): Promise<boolean>;
  restore(): Promise<boolean>;
  refresh(): Promise<void>;
  setUseHostedAi(on: boolean): Promise<void>;
  reset(): Promise<void>;
  consentNeeded(nextValue: boolean): boolean;
  recordConsent(): Promise<void>;
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
  const [busy, setBusy] = useState(false);
  const [useHostedAi, setUseHostedAiState] = useState(false);
  const [consentVersion, setConsentVersion] = useState<number | null>(null);
  const mounted = useRef(true);
  const signal = useSyncExternalStore(subscribeHostedSignal, getHostedSignal, getHostedSignal);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const applyOverview = useCallback(async (next: PremiumOverview) => {
    if (!mounted.current) {
      return;
    }

    setOverview(next);

    if (await disableHostedIfRemoved(next.status)) {
      if (mounted.current) {
        setUseHostedAiState(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    await applyOverview(await loadPremiumOverview());
  }, [enabled, applyOverview]);

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

    SettingsService.get(SETTINGS.useHostedAi)
      .then((value) => {
        if (!cancelled) {
          setUseHostedAiState(value);
        }
      })
      .catch(() => undefined);

    SettingsService.get(SETTINGS.premiumConsentVersion)
      .then((value) => {
        if (!cancelled) {
          setConsentVersion(value);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled, applyOverview]);

  const runAction = useCallback(
    async (action: () => Promise<{ ok: true } | { ok: false; failure: PremiumActionFailure }>) => {
      setBusy(true);

      try {
        const result = await action();

        if (!mounted.current) {
          return false;
        }

        if (result.ok) {
          setLastActionFailure(null);
          await refresh();

          return true;
        }

        setLastActionFailure(result.failure);

        return false;
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    },
    [refresh]
  );

  const subscribe = useCallback(async () => {
    if (!enabled) {
      return false;
    }

    return runAction(() => subscribeAction());
  }, [enabled, runAction]);

  const restore = useCallback(async () => {
    if (!enabled) {
      return false;
    }

    return runAction(() => restoreAction());
  }, [enabled, runAction]);

  const setUseHostedAi = useCallback(
    async (on: boolean) => {
      if (!enabled) {
        return;
      }

      await setUseHostedAiAction(on);

      if (mounted.current) {
        setUseHostedAiState(on);
      }
    },
    [enabled]
  );

  const reset = useCallback(async () => {
    if (!enabled) {
      return;
    }

    await resetPremiumOnThisDevice();

    if (mounted.current) {
      setUseHostedAiState(false);
      setLastActionFailure(null);
    }

    await refresh();
  }, [enabled, refresh]);

  const consentNeeded = useCallback(
    (nextValue: boolean) => needsPremiumConsent(consentVersion, useHostedAi, nextValue),
    [consentVersion, useHostedAi]
  );

  const recordConsent = useCallback(async () => {
    if (!enabled) {
      return;
    }

    await SettingsService.set(SETTINGS.premiumConsentVersion, PREMIUM_CONSENT_VERSION);

    if (mounted.current) {
      setConsentVersion(PREMIUM_CONSENT_VERSION);
    }
  }, [enabled]);

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

  return (
    fixture ?? {
      enabled,
      view,
      priceString: enabled ? (overview?.priceString ?? null) : null,
      busy,
      useHostedAi,
      subscribe,
      restore,
      refresh,
      setUseHostedAi,
      reset,
      consentNeeded,
      recordConsent,
    }
  );
}
