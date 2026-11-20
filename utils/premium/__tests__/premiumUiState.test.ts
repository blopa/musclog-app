/**
 * Rule table for the Premium view model (plan 11 item 7). Each row is one branch:
 * status null -> loading; no_key/not_enrolled -> not_subscribed; active/exhausted/revoked/removed;
 * a config that is disabled or not accepting; a failed config read; the action failures; the
 * Worker's signal; the 80% warning.
 */
import type { HostedConfig, PremiumStatus, UsageSnapshot } from '../premiumState';
import {
  buildPremiumViewModel,
  PREMIUM_WARNING_PCT,
  type PremiumViewInput,
} from '../premiumUiState';

const OPEN: HostedConfig = {
  enabled: true,
  acceptingNew: true,
  visionEnabled: false,
  image: null,
  minAppVersion: null,
};

const USAGE: UsageSnapshot = {
  usedPct: 40,
  resetsAt: '2026-12-01T00:00:00Z',
  status: 'active',
  devices: { count: 1, max: 3 },
};

const base: PremiumViewInput = {
  status: 'not_enrolled',
  config: OPEN,
  configFailure: null,
  usage: null,
  lastActionFailure: null,
  signal: null,
  busy: false,
};

const view = (over: Partial<PremiumViewInput>) => buildPremiumViewModel({ ...base, ...over });

describe('PREMIUM_WARNING_PCT', () => {
  it('is 80', () => {
    expect(PREMIUM_WARNING_PCT).toBe(80);
  });
});

describe('phase', () => {
  it.each<[PremiumStatus | null, string]>([
    [null, 'loading'],
    ['no_key', 'not_subscribed'],
    ['not_enrolled', 'not_subscribed'],
    ['active', 'active'],
    ['exhausted', 'exhausted'],
    ['revoked', 'revoked'],
    ['removed', 'removed'],
  ])('status %s -> phase %s', (status, phase) => {
    expect(view({ status }).phase).toBe(phase);
  });

  it('a removed or revoked signal moves an active device to that phase', () => {
    expect(view({ status: 'active', signal: 'removed' }).phase).toBe('removed');
    expect(view({ status: 'active', signal: 'exhausted' }).phase).toBe('exhausted');
    expect(view({ status: 'active', signal: 'daily_full' }).phase).toBe('active');
  });
});

describe('canSubscribe', () => {
  it('needs not_subscribed, an enabled accepting config and no busy action', () => {
    expect(view({ status: 'no_key' }).canSubscribe).toBe(true);
    expect(view({ status: 'no_key', busy: true }).canSubscribe).toBe(false);
    expect(view({ status: 'active' }).canSubscribe).toBe(false);
    expect(view({ status: 'no_key', config: null }).canSubscribe).toBe(false);
    expect(view({ status: 'no_key', config: { ...OPEN, enabled: false } }).canSubscribe).toBe(
      false
    );
    expect(view({ status: 'no_key', config: { ...OPEN, acceptingNew: false } }).canSubscribe).toBe(
      false
    );
  });
});

describe('canRestore', () => {
  it('is offered when not subscribed or removed, and not while busy', () => {
    expect(view({ status: 'not_enrolled' }).canRestore).toBe(true);
    expect(view({ status: 'removed' }).canRestore).toBe(true);
    expect(view({ status: 'no_key', busy: true }).canRestore).toBe(false);
    expect(view({ status: 'active' }).canRestore).toBe(false);
    expect(view({ status: 'exhausted' }).canRestore).toBe(false);
    expect(view({ status: 'revoked' }).canRestore).toBe(false);
    expect(view({ status: null }).canRestore).toBe(false);
  });
});

describe('usage and hosted switch', () => {
  it('shows usage only for a known usage on an active or exhausted subscription', () => {
    const active = view({ status: 'active', usage: USAGE });

    expect(active.showUsage).toBe(true);
    expect(active.usedPct).toBe(40);
    expect(active.resetsAt).toBe(USAGE.resetsAt);
    expect(active.devices).toEqual({ count: 1, max: 3 });
    expect(view({ status: 'exhausted', usage: USAGE }).showUsage).toBe(true);
    expect(view({ status: 'revoked', usage: USAGE }).showUsage).toBe(false);
    expect(view({ status: 'active', usage: null }).showUsage).toBe(false);
  });

  it('offers the hosted switch only when active', () => {
    expect(view({ status: 'active' }).canUseHosted).toBe(true);
    expect(view({ status: 'exhausted' }).canUseHosted).toBe(false);
    expect(view({ status: 'no_key' }).canUseHosted).toBe(false);
  });
});

describe('notice', () => {
  // Each row: the inputs, and the notice the screen must show.
  const table: [string, Partial<PremiumViewInput>, string | null][] = [
    ['loading has no notice', { status: null }, null],
    ['a clean subscribable state has none', {}, null],
    ['purchase cancelled', { lastActionFailure: 'purchase_cancelled' }, 'purchase_cancelled'],
    ['purchase failed', { lastActionFailure: 'purchase_failed' }, 'purchase_failed'],
    ['restore found nothing', { lastActionFailure: 'restore_failed' }, 'restore_nothing'],
    [
      'subscription not yet visible after restore',
      { lastActionFailure: 'subscription_required' },
      'restore_nothing',
    ],
    ['entitlement lag', { lastActionFailure: 'entitlement_unavailable' }, 'restore_nothing'],
    ['network is offline', { lastActionFailure: 'network' }, 'offline'],
    ['worker unavailable', { lastActionFailure: 'unavailable' }, 'unavailable'],
    ['not available here', { lastActionFailure: 'not_available' }, 'not_available'],
    ['config disabled', { config: { ...OPEN, enabled: false } }, 'unavailable'],
    ['not accepting new', { config: { ...OPEN, acceptingNew: false } }, 'not_accepting'],
    ['config unreachable (network)', { config: null, configFailure: 'network' }, 'offline'],
    ['config unreachable (other)', { config: null, configFailure: 'unavailable' }, 'unavailable'],
    ['removed', { status: 'removed' }, 'removed'],
    ['revoked', { status: 'revoked' }, 'revoked'],
    ['exhausted', { status: 'exhausted', usage: { ...USAGE, usedPct: 100 } }, 'exhausted'],
    ['daily capacity', { status: 'active', signal: 'daily_full' }, 'at_capacity'],
    ['signal unavailable', { status: 'active', signal: 'unavailable' }, 'unavailable'],
    ['signal removed', { status: 'active', signal: 'removed' }, 'removed'],
    ['80 percent used', { status: 'active', usage: { ...USAGE, usedPct: 80 } }, 'warning80'],
    ['99 percent used', { status: 'active', usage: { ...USAGE, usedPct: 99 } }, 'warning80'],
    ['79 percent is quiet', { status: 'active', usage: { ...USAGE, usedPct: 79 } }, null],
    [
      '100 percent is exhausted, not a warning',
      { status: 'active', usage: { ...USAGE, usedPct: 100 } },
      null,
    ],
    [
      'a purchase failure outranks removal',
      { status: 'removed', lastActionFailure: 'purchase_failed' },
      'purchase_failed',
    ],
    [
      'removed outranks the 80 percent warning',
      { status: 'removed', usage: { ...USAGE, usedPct: 90 } },
      'removed',
    ],
    [
      'config disabled outranks not accepting',
      { config: { ...OPEN, enabled: false, acceptingNew: false } },
      'unavailable',
    ],
    [
      'capacity outranks the 80 percent warning',
      { status: 'active', signal: 'daily_full', usage: { ...USAGE, usedPct: 90 } },
      'at_capacity',
    ],
  ];

  it.each(table)('%s', (_name, over, expected) => {
    expect(view({ ...over }).notice).toBe(expected);
  });
});
