import {
  derivePremiumStatus,
  failureKindOf,
  isEntitlementLag,
  parseHostedConfig,
  parseSessionGrant,
  parseUsage,
  TOKEN_REFRESH_MARGIN_MS,
  tokenNeedsRefresh,
} from '@/utils/premium/premiumState';
import { IDENTITY_ERROR_CODES } from '@/utils/premium/workerError';

const GOOD_GRANT = {
  session_token: 'tok-abc',
  expires_at: '2026-12-01T00:00:00.000Z',
  period: { used_pct: 42, resets_at: '2026-12-15T00:00:00.000Z' },
  devices: { count: 1, max: 3 },
};

describe('failureKindOf', () => {
  it('reports a network failure for status 0 or the network code', () => {
    expect(failureKindOf({ status: 0, errorCode: null })).toBe('network');
    expect(failureKindOf({ status: 500, errorCode: 'network' })).toBe('network');
  });

  it.each(IDENTITY_ERROR_CODES)('keeps the known code %s at a 4xx status', (code) => {
    expect(failureKindOf({ status: 401, errorCode: code })).toBe(code);
  });

  it('keeps a known code even on a 5xx status', () => {
    expect(failureKindOf({ status: 500, errorCode: 'bad_signature' })).toBe('bad_signature');
  });

  it('maps an unknown code at a 4xx status to unknown', () => {
    expect(failureKindOf({ status: 400, errorCode: 'something_new' })).toBe('unknown');
    expect(failureKindOf({ status: 404, errorCode: null })).toBe('unknown');
  });

  it('maps an unknown code at a 5xx status to unavailable', () => {
    expect(failureKindOf({ status: 503, errorCode: 'something_new' })).toBe('unavailable');
    expect(failureKindOf({ status: 500, errorCode: null })).toBe('unavailable');
  });
});

describe('isEntitlementLag', () => {
  it('is true only for the two RevenueCat lag failures', () => {
    expect(isEntitlementLag('subscription_required')).toBe(true);
    expect(isEntitlementLag('entitlement_unavailable')).toBe(true);
  });

  it.each([
    'unauthorized',
    'unknown_device',
    'network',
    'unavailable',
    'invalid_response',
  ] as const)('is false for %s', (kind) => {
    expect(isEntitlementLag(kind)).toBe(false);
  });
});

describe('parseSessionGrant', () => {
  it('parses a good body into the grant', () => {
    expect(parseSessionGrant(GOOD_GRANT)).toEqual({
      sessionToken: 'tok-abc',
      expiresAtMs: Date.parse('2026-12-01T00:00:00.000Z'),
      usedPct: 42,
      resetsAt: '2026-12-15T00:00:00.000Z',
      devices: { count: 1, max: 3 },
    });
  });

  it.each([
    ['null body', null],
    ['missing period', { ...GOOD_GRANT, period: undefined }],
    ['missing token', { ...GOOD_GRANT, session_token: undefined }],
    ['empty token', { ...GOOD_GRANT, session_token: '' }],
    ['bad date', { ...GOOD_GRANT, expires_at: 'nope' }],
    ['used_pct 101', { ...GOOD_GRANT, period: { ...GOOD_GRANT.period, used_pct: 101 } }],
    ['negative used_pct', { ...GOOD_GRANT, period: { ...GOOD_GRANT.period, used_pct: -1 } }],
    ['devices count above max', { ...GOOD_GRANT, devices: { count: 4, max: 3 } }],
    ['non-integer devices count', { ...GOOD_GRANT, devices: { count: 1.5, max: 3 } }],
    ['missing resets_at', { ...GOOD_GRANT, period: { used_pct: 1 } }],
  ])('returns null for %s', (_label, body) => {
    expect(parseSessionGrant(body)).toBeNull();
  });
});

describe('parseUsage', () => {
  const good = {
    status: 'exhausted',
    used_pct: 100,
    resets_at: '2026-12-15T00:00:00.000Z',
    devices: { count: 2, max: 3 },
  };

  it('parses a good body', () => {
    expect(parseUsage(good)).toEqual({
      usedPct: 100,
      resetsAt: '2026-12-15T00:00:00.000Z',
      status: 'exhausted',
      devices: { count: 2, max: 3 },
    });
  });

  it('ignores unknown fields', () => {
    expect(parseUsage({ ...good, extra: 'x' })).not.toHaveProperty('extra');
  });

  it.each([
    ['unknown status', { ...good, status: 'paused' }],
    ['used_pct above 100', { ...good, used_pct: 101 }],
    ['missing resets_at', { ...good, resets_at: undefined }],
    ['bad devices', { ...good, devices: { count: 5, max: 3 } }],
    ['non-object', 'text'],
  ])('returns null for %s', (_label, body) => {
    expect(parseUsage(body)).toBeNull();
  });
});

describe('parseHostedConfig', () => {
  const good = {
    enabled: true,
    accepting_new: true,
    vision_enabled: false,
    image: { maxPx: 1024, maxBytes: 500000, quality: 80 },
    minAppVersion: '2.17.0',
  };

  it('parses a good body', () => {
    expect(parseHostedConfig(good)).toEqual({
      enabled: true,
      acceptingNew: true,
      visionEnabled: false,
      image: { maxPx: 1024, maxBytes: 500000, quality: 0.8 },
      minAppVersion: '2.17.0',
    });
  });

  it("reads the Worker's whole-percent JPEG quality as a 0 to 1 fraction", () => {
    expect(
      parseHostedConfig({ ...good, image: { maxPx: 1568, maxBytes: 400000, quality: 85 } })?.image
    ).toEqual({ maxPx: 1568, maxBytes: 400000, quality: 0.85 });
  });

  it('maps a null image to null', () => {
    expect(parseHostedConfig({ ...good, image: null })?.image).toBeNull();
  });

  it('ignores unknown fields', () => {
    const parsed = parseHostedConfig({
      ...good,
      surprise: 1,
      image: { maxPx: 1, maxBytes: 2, quality: 50, extra: 4 },
    });

    expect(parsed).not.toHaveProperty('surprise');
    expect(parsed?.image).toEqual({ maxPx: 1, maxBytes: 2, quality: 0.5 });
  });

  it('treats non-true accepting_new and vision_enabled as false', () => {
    const parsed = parseHostedConfig({ ...good, accepting_new: 'yes', vision_enabled: 1 });

    expect(parsed?.acceptingNew).toBe(false);
    expect(parsed?.visionEnabled).toBe(false);
  });

  it('drops a non-string minAppVersion', () => {
    expect(parseHostedConfig({ ...good, minAppVersion: 2 })?.minAppVersion).toBeNull();
  });

  it.each([
    ['enabled not a boolean', { ...good, enabled: 'true' }],
    ['not an object', null],
  ])('returns null for %s', (_label, body) => {
    expect(parseHostedConfig(body)).toBeNull();
  });
});

describe('tokenNeedsRefresh', () => {
  const expiresAt = 1_800_000_000_000;

  it('uses a five minute margin by default', () => {
    expect(TOKEN_REFRESH_MARGIN_MS).toBe(5 * 60_000);
  });

  it('is true at exactly five minutes before expiry', () => {
    expect(tokenNeedsRefresh(expiresAt, expiresAt - 5 * 60_000)).toBe(true);
  });

  it('is false one millisecond earlier', () => {
    expect(tokenNeedsRefresh(expiresAt, expiresAt - 5 * 60_000 - 1)).toBe(false);
  });

  it('is true after expiry', () => {
    expect(tokenNeedsRefresh(expiresAt, expiresAt + 1)).toBe(true);
  });
});

describe('derivePremiumStatus', () => {
  const base = { enrolledRcId: 'mlg1_x', removed: false, lastStatus: null } as const;

  it('is removed when removed, even with no enrollment (removed beats not_enrolled)', () => {
    expect(derivePremiumStatus({ ...base, enrolledRcId: null, removed: true })).toBe('removed');
  });

  it('is removed when removed and enrolled', () => {
    expect(derivePremiumStatus({ ...base, removed: true, lastStatus: 'active' })).toBe('removed');
  });

  it('is not_enrolled without an enrolled id (no device key means no enrollment)', () => {
    expect(derivePremiumStatus({ ...base, enrolledRcId: null })).toBe('not_enrolled');
    expect(derivePremiumStatus({ ...base, enrolledRcId: null, lastStatus: 'active' })).toBe(
      'not_enrolled'
    );
  });

  it('is active when enrolled and no status has been seen yet', () => {
    expect(derivePremiumStatus({ ...base, lastStatus: null })).toBe('active');
  });

  it.each(['active', 'exhausted', 'revoked'] as const)('follows the last status %s', (status) => {
    expect(derivePremiumStatus({ ...base, lastStatus: status })).toBe(status);
  });
});
