import { premiumFailureReport } from '@/utils/premium/premiumReport';

describe('premiumFailureReport', () => {
  it.each(['purchase_cancelled', 'network', 'not_enrolled'] as const)('does not report %s', (f) => {
    expect(premiumFailureReport('enroll', f)).toBeNull();
  });

  it.each(['stale_nonce', 'unknown_device', 'unauthorized', 'unavailable'] as const)(
    'warns for %s',
    (f) => {
      expect(premiumFailureReport('session', f)?.level).toBe('warning');
    }
  );

  it.each([
    'subscription_required',
    'entitlement_unavailable',
    'not_available',
    'invalid_response',
    'unknown',
    'purchase_failed',
    'restore_failed',
    'id_key_mismatch',
    'bad_signature',
    'identity_conflict',
    'revenue_unverified',
    'invalid_request',
  ] as const)('errors for %s', (f) => {
    expect(premiumFailureReport('enroll', f)?.level).toBe('error');
  });

  it('shapes message, fingerprint and base tags', () => {
    expect(premiumFailureReport('enroll', 'subscription_required')).toEqual({
      message: 'premium-enroll-subscription_required',
      level: 'error',
      tags: { premium_stage: 'enroll', premium_failure: 'subscription_required' },
      fingerprint: ['premium', 'enroll', 'subscription_required'],
    });
  });

  it('adds http_status and store_error_code only when given', () => {
    const report = premiumFailureReport('purchase', 'purchase_failed', {
      status: 403,
      storeErrorCode: '6',
    });

    expect(Object.keys(report!.tags).sort()).toEqual(
      ['http_status', 'premium_failure', 'premium_stage', 'store_error_code'].sort()
    );
    expect(report!.tags.http_status).toBe('403');
    expect(report!.tags.store_error_code).toBe('6');
    expect(Object.keys(premiumFailureReport('usage', 'unknown', {})!.tags)).toEqual([
      'premium_stage',
      'premium_failure',
    ]);
  });
});

describe('a device that cannot buy', () => {
  // RevenueCat code 3 (PURCHASE_NOT_ALLOWED): Play billing unavailable, e.g. an emulator with no
  // account. Nothing in the app can fix it.
  it.each([
    ['restore', 'restore_failed'],
    ['purchase', 'purchase_failed'],
    ['price', 'unknown'],
  ] as const)('does not report a %s the store does not allow', (stage, failure) => {
    expect(premiumFailureReport(stage, failure, { storeErrorCode: '3' })).toBeNull();
  });

  it('still reports the other store errors of a restore', () => {
    expect(
      premiumFailureReport('restore', 'restore_failed', { storeErrorCode: '2' })
    ).not.toBeNull();
  });
});

describe('premium flow', () => {
  it('does not report a restore that found no subscription', () => {
    expect(
      premiumFailureReport('enroll', 'subscription_required', { status: 403, flow: 'restore' })
    ).toBeNull();
  });

  it('still reports a purchase that ended with no subscription, tagged with its flow', () => {
    const report = premiumFailureReport('enroll', 'subscription_required', {
      status: 403,
      flow: 'purchase',
    });

    expect(report?.level).toBe('error');
    expect(report?.tags.premium_flow).toBe('purchase');
  });

  it('still reports other failures of a restore', () => {
    expect(
      premiumFailureReport('enroll', 'entitlement_unavailable', { status: 503, flow: 'restore' })
    ).not.toBeNull();
  });

  it('still reports subscription_required from an enroll known to follow a subscription', () => {
    expect(
      premiumFailureReport('enroll', 'subscription_required', { status: 403, flow: 'enroll' })
    ).not.toBeNull();
  });
});

describe('price stage network failure', () => {
  it('is not reported', () => {
    expect(premiumFailureReport('price', 'network', { storeErrorCode: '10' })).toBeNull();
  });
});
