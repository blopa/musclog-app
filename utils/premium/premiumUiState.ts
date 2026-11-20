// Pure view model for the Premium screens (plan 11 item 7). Relative imports only, no React Native:
// the screens render exactly what this returns, and the tests pin every branch.
import type { HostedSignal } from './hostedSignal';
import type {
  HostedConfig,
  PremiumActionFailure,
  PremiumStatus,
  UsageSnapshot,
} from './premiumState';

/** The "close to the limit" note starts here (percent of this period's allowance used). */
export const PREMIUM_WARNING_PCT = 80;

export type PremiumNotice =
  | 'offline'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restore_nothing'
  | 'removed'
  | 'revoked'
  | 'exhausted'
  | 'at_capacity'
  | 'unavailable'
  | 'not_accepting'
  | 'not_available'
  | 'warning80';

export type PremiumPhase =
  'loading' | 'not_subscribed' | 'active' | 'removed' | 'revoked' | 'exhausted';

export type PremiumViewModel = {
  phase: PremiumPhase;
  notice: PremiumNotice | null;
  canSubscribe: boolean;
  canRestore: boolean;
  showUsage: boolean;
  usedPct: number | null;
  resetsAt: string | null;
  devices: { count: number; max: number } | null;
  canUseHosted: boolean;
};

export type PremiumViewInput = {
  /** null = the status has not been read yet. */
  status: PremiumStatus | null;
  config: HostedConfig | null;
  configFailure: PremiumActionFailure | null;
  usage: UsageSnapshot | null;
  lastActionFailure: PremiumActionFailure | null;
  signal: HostedSignal | null;
  busy: boolean;
};

const RESTORE_NOTHING_FAILURES: readonly PremiumActionFailure[] = [
  'restore_failed',
  'subscription_required',
  'entitlement_unavailable',
];

const ACTION_NOTICES: Partial<Record<PremiumActionFailure, PremiumNotice>> = {
  purchase_cancelled: 'purchase_cancelled',
  purchase_failed: 'purchase_failed',
  network: 'offline',
  unavailable: 'unavailable',
  not_available: 'not_available',
};

function phaseOf(status: PremiumStatus | null): PremiumPhase {
  switch (status) {
    case null:
      return 'loading';
    case 'active':
      return 'active';
    case 'exhausted':
      return 'exhausted';
    case 'revoked':
      return 'revoked';
    case 'removed':
      return 'removed';
    default:
      return 'not_subscribed';
  }
}

/** The Worker's signal can move a known phase: a removed device, or a period that ran out. */
function applySignal(phase: PremiumPhase, signal: HostedSignal | null): PremiumPhase {
  if (phase === 'loading') {
    return phase;
  }

  if (signal === 'removed') {
    return 'removed';
  }

  if (signal === 'exhausted' && phase === 'active') {
    return 'exhausted';
  }

  return phase;
}

/** The first notice that applies, in the order the screens show them. */
function noticeOf(input: PremiumViewInput, phase: PremiumPhase): PremiumNotice | null {
  const { lastActionFailure: failure, config, configFailure, signal, usage } = input;

  if (failure && RESTORE_NOTHING_FAILURES.includes(failure)) {
    return 'restore_nothing';
  }

  if (failure && ACTION_NOTICES[failure]) {
    return ACTION_NOTICES[failure] ?? null;
  }

  if (phase === 'not_subscribed') {
    if (config === null && configFailure !== null) {
      return configFailure === 'network' ? 'offline' : 'unavailable';
    }

    if (config?.enabled === false) {
      return 'unavailable';
    }

    if (config !== null && !config.acceptingNew) {
      return 'not_accepting';
    }
  }

  if (phase === 'removed') {
    return 'removed';
  }

  if (phase === 'revoked') {
    return 'revoked';
  }

  if (phase === 'exhausted') {
    return 'exhausted';
  }

  if (signal === 'daily_full') {
    return 'at_capacity';
  }

  if (signal === 'unavailable') {
    return 'unavailable';
  }

  if (phase === 'active' && usage && usage.usedPct >= PREMIUM_WARNING_PCT && usage.usedPct < 100) {
    return 'warning80';
  }

  return null;
}

export function buildPremiumViewModel(input: PremiumViewInput): PremiumViewModel {
  const phase = applySignal(phaseOf(input.status), input.signal);
  const { config, usage, busy } = input;
  const usable = phase === 'active' || phase === 'exhausted';

  return {
    phase,
    notice: phase === 'loading' ? null : noticeOf(input, phase),
    canSubscribe:
      phase === 'not_subscribed' &&
      config !== null &&
      config.enabled !== false &&
      config.acceptingNew === true &&
      !busy,
    canRestore: (phase === 'not_subscribed' || phase === 'removed') && !busy,
    showUsage: usage !== null && usable,
    usedPct: usage !== null && usable ? usage.usedPct : null,
    resetsAt: usage !== null && usable ? usage.resetsAt : null,
    devices: usage !== null ? usage.devices : null,
    canUseHosted: phase === 'active',
  };
}
