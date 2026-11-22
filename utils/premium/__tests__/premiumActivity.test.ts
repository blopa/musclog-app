import {
  beginPremiumActivity,
  busyLineFor,
  endPremiumActivity,
  getPremiumActivity,
  getPremiumConsentPending,
  reportPremiumProgress,
  resetPremiumActivity,
  SLOW_CONFIRM_MS,
  takePremiumConsentPending,
  dismissPremiumActionFailure,
  getPremiumActionFailure,
} from '@/utils/premium/premiumActivity';

beforeEach(() => {
  jest.useFakeTimers();
  resetPremiumActivity();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('premiumActivity stages', () => {
  it('starts a purchase on the store stage and maps each stage to its own line', () => {
    expect(busyLineFor(null)).toBeNull();
    expect(beginPremiumActivity('subscribe')).toBe(true);
    expect(busyLineFor(getPremiumActivity())).toBe('store');

    reportPremiumProgress('confirming');
    expect(busyLineFor(getPremiumActivity())).toBe('confirming');
  });

  it('turns confirming into slow after SLOW_CONFIRM_MS, and a retry does not restart or reset it', () => {
    beginPremiumActivity('restore');
    reportPremiumProgress('confirming');
    jest.advanceTimersByTime(SLOW_CONFIRM_MS - 1);
    expect(getPremiumActivity()?.stage).toBe('confirming');

    reportPremiumProgress('confirming'); // a retry must not push the deadline back
    jest.advanceTimersByTime(1);
    expect(getPremiumActivity()?.stage).toBe('slow');

    reportPremiumProgress('confirming');
    expect(getPremiumActivity()?.stage).toBe('slow');
  });

  it('never goes slow once the activity has ended', () => {
    beginPremiumActivity('subscribe');
    reportPremiumProgress('confirming');
    endPremiumActivity('subscribe', { ok: false, failure: 'network' });
    jest.advanceTimersByTime(SLOW_CONFIRM_MS * 2);

    expect(getPremiumActivity()).toBeNull();
  });

  it('reset and toggle map to their own lines and have no stage', () => {
    beginPremiumActivity('reset');
    expect(busyLineFor(getPremiumActivity())).toBe('reset');
    reportPremiumProgress('confirming'); // ignored outside a purchase
    expect(getPremiumActivity()?.stage).toBeNull();
    endPremiumActivity('reset', { ok: true });

    beginPremiumActivity('toggle');
    expect(busyLineFor(getPremiumActivity())).toBe('toggle');
  });

  it('refuses a second action while one runs', () => {
    expect(beginPremiumActivity('subscribe')).toBe(true);
    expect(beginPremiumActivity('restore')).toBe(false);
    expect(getPremiumActivity()?.kind).toBe('subscribe');
  });
});

describe('premiumActivity results that outlive a screen', () => {
  it('leaves the consent question pending after a successful purchase or restore, once', () => {
    beginPremiumActivity('subscribe');
    endPremiumActivity('subscribe', { ok: true });

    expect(getPremiumConsentPending()).toBe(true);
    expect(takePremiumConsentPending()).toBe(true);
    expect(takePremiumConsentPending()).toBe(false);
  });

  it('asks no consent after a failure, a reset or a toggle', () => {
    beginPremiumActivity('restore');
    endPremiumActivity('restore', { ok: false, failure: 'restore_failed' });
    beginPremiumActivity('reset');
    endPremiumActivity('reset', { ok: true });
    beginPremiumActivity('toggle');
    endPremiumActivity('toggle', { ok: true });

    expect(getPremiumConsentPending()).toBe(false);
  });

  it('keeps the last failure in the store until it is dismissed or a new action starts', () => {
    beginPremiumActivity('subscribe');
    endPremiumActivity('subscribe', { ok: false, failure: 'purchase_failed' });

    expect(getPremiumActionFailure()).toBe('purchase_failed');
    expect(getPremiumActionFailure()).toBe('purchase_failed');

    dismissPremiumActionFailure();
    expect(getPremiumActionFailure()).toBeNull();
  });

  it('clears the failure when a new action starts, and when one succeeds', () => {
    beginPremiumActivity('subscribe');
    endPremiumActivity('subscribe', { ok: false, failure: 'network' });
    beginPremiumActivity('restore');
    expect(getPremiumActionFailure()).toBeNull();
    endPremiumActivity('restore', { ok: false, failure: 'restore_failed' });
    expect(getPremiumActionFailure()).toBe('restore_failed');
    beginPremiumActivity('reset');
    endPremiumActivity('reset', { ok: true });
    expect(getPremiumActionFailure()).toBeNull();
  });
});
