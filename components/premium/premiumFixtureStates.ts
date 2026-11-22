// The eight Premium states the `/app/test/modals` fixture renders (one button each). Every view is
// the real view model, built from a mocked input, so the screen shows what the app would show in
// that state. Pure: no React Native, no service, no network.
import type { UsePremium } from '@/hooks/usePremium';
import type { HostedSignal } from '@/utils/premium/hostedSignal';
import type { PremiumActivity } from '@/utils/premium/premiumActivity';
import type {
  HostedConfig,
  PremiumActionFailure,
  PremiumStatus,
  UsageSnapshot,
} from '@/utils/premium/premiumState';
import { buildPremiumViewModel, type PremiumViewInput } from '@/utils/premium/premiumUiState';

export type PremiumFixtureState = {
  id: string;
  label: string;
  build(): UsePremium;
};

const CONFIG_ON: HostedConfig = {
  enabled: true,
  acceptingNew: true,
  visionEnabled: false,
  image: null,
  minAppVersion: null,
};

const RESETS_AT = '2026-12-01T00:00:00.000Z';

function usage(usedPct: number, status: UsageSnapshot['status'] = 'active'): UsageSnapshot {
  return { usedPct, resetsAt: RESETS_AT, status, devices: { count: 2, max: 3 } };
}

type FixtureInput = {
  status: PremiumStatus | null;
  config?: HostedConfig | null;
  usage?: UsageSnapshot | null;
  lastActionFailure?: PremiumActionFailure | null;
  signal?: HostedSignal | null;
  activity?: PremiumActivity | null;
};

function noopActions(): Omit<UsePremium, 'view' | 'priceString'> {
  return {
    enabled: true,
    busy: false,
    activity: null,
    useHostedAi: false,
    subscribe: async () => false,
    restore: async () => false,
    refresh: async () => undefined,
    setUseHostedAi: async () => undefined,
    reset: async () => undefined,
    consentNeeded: () => false,
    recordConsent: async () => undefined,
  };
}

function premiumFor(input: FixtureInput, priceString: string | null = '€4.99'): UsePremium {
  const viewInput: PremiumViewInput = {
    status: input.status,
    config: input.config ?? null,
    configFailure: null,
    usage: input.usage ?? null,
    lastActionFailure: input.lastActionFailure ?? null,
    signal: input.signal ?? null,
    busy: input.activity != null,
  };

  return {
    ...noopActions(),
    busy: input.activity != null,
    activity: input.activity ?? null,
    view: buildPremiumViewModel(viewInput),
    priceString,
  };
}

export const PREMIUM_FIXTURE_STATES: readonly PremiumFixtureState[] = [
  {
    id: 'loading',
    label: 'Loading',
    build: () => premiumFor({ status: null }, null),
  },
  {
    id: 'not-subscribed',
    label: 'Not Subscribed',
    build: () => premiumFor({ status: 'not_enrolled', config: CONFIG_ON }),
  },
  {
    id: 'active',
    label: 'Active',
    build: () => premiumFor({ status: 'active', config: CONFIG_ON, usage: usage(40) }),
  },
  {
    id: 'exhausted',
    label: 'Exhausted',
    build: () =>
      premiumFor({ status: 'exhausted', config: CONFIG_ON, usage: usage(100, 'exhausted') }),
  },
  {
    id: 'removed',
    label: 'Removed',
    build: () => premiumFor({ status: 'removed', config: CONFIG_ON }),
  },
  {
    id: 'revoked',
    label: 'Revoked',
    build: () => premiumFor({ status: 'revoked', config: CONFIG_ON }),
  },
  {
    id: 'at-capacity',
    label: 'At Capacity',
    build: () =>
      premiumFor({ status: 'active', config: CONFIG_ON, usage: usage(40), signal: 'daily_full' }),
  },
  {
    id: 'offline',
    label: 'Offline',
    build: () =>
      premiumFor({ status: 'not_enrolled', config: CONFIG_ON, lastActionFailure: 'network' }),
  },
  // Busy states, appended (never reordered): the audit reaches them as 'Open Premium Modal (<label>)'.
  {
    id: 'store-wait',
    label: 'Waiting For Store',
    build: () =>
      premiumFor({
        status: 'not_enrolled',
        config: CONFIG_ON,
        activity: { kind: 'subscribe', stage: 'store' },
      }),
  },
  {
    id: 'confirming',
    label: 'Confirming Subscription',
    build: () =>
      premiumFor({
        status: 'not_enrolled',
        config: CONFIG_ON,
        activity: { kind: 'subscribe', stage: 'confirming' },
      }),
  },
  {
    id: 'confirming-slow',
    label: 'Confirming Slowly',
    build: () =>
      premiumFor({
        status: 'not_enrolled',
        config: CONFIG_ON,
        activity: { kind: 'restore', stage: 'slow' },
      }),
  },
  {
    id: 'resetting',
    label: 'Resetting',
    build: () =>
      premiumFor({
        status: 'active',
        config: CONFIG_ON,
        usage: usage(40),
        activity: { kind: 'reset', stage: null },
      }),
  },
];
