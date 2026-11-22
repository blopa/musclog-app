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
