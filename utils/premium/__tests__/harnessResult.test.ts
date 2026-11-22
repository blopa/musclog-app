import {
  describeError,
  makeLogEntry,
  serializeLog,
  summarizeCustomerInfo,
  summarizePurchase,
  toJsonSafe,
} from '../harnessResult';

describe('toJsonSafe', () => {
  it('converts dates, bigint, maps and sets and drops functions', () => {
    const out = toJsonSafe({
      d: new Date('2026-01-02T03:04:05.000Z'),
      b: BigInt(5),
      m: new Map([['a', 1]]),
      s: new Set([1, 2]),
      f: () => 1,
      u: undefined,
    });

    expect(out).toEqual({ d: '2026-01-02T03:04:05.000Z', b: '5', m: { a: 1 }, s: [1, 2] });
  });

  it('replaces cycles', () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;

    expect(toJsonSafe(a)).toEqual({ x: 1, self: '[circular]' });
  });

  it('caps depth and string length and never throws', () => {
    let deep: Record<string, unknown> = { leaf: true };

    for (let i = 0; i < 30; i++) {
      deep = { n: deep };
    }

    expect(() => JSON.stringify(toJsonSafe(deep))).not.toThrow();
    expect(JSON.stringify(toJsonSafe(deep))).toContain('[max depth]');
    expect((toJsonSafe('x'.repeat(30000)) as string).length).toBe(20000);

    const evil = {
      get boom(): unknown {
        throw new Error('no');
      },
    };

    expect(() => toJsonSafe(evil)).not.toThrow();
  });
});

describe('describeError', () => {
  it('keeps purchases error fields', () => {
    const e = Object.assign(new Error('cancelled'), {
      code: '1',
      userCancelled: true,
      underlyingErrorMessage: 'u',
      readableErrorCode: 'PURCHASE_CANCELLED',
    });

    expect(describeError(e)).toEqual({
      name: 'Error',
      message: 'cancelled',
      code: '1',
      userCancelled: true,
      underlyingErrorMessage: 'u',
      readableErrorCode: 'PURCHASE_CANCELLED',
    });
  });

  it('handles non-errors', () => {
    expect(describeError('x')).toEqual({ name: 'Error', message: 'x' });
  });
});

describe('summarizeCustomerInfo', () => {
  it('is tolerant of missing fields', () => {
    const s = summarizeCustomerInfo(undefined);

    expect(s.originalAppUserId).toBeNull();
    expect(s.activeEntitlementIds).toEqual([]);
    expect(s.activeSubscriptions).toEqual([]);
    expect(s.managementURL).toBeNull();
  });

  it('reads the real fields', () => {
    const s = summarizeCustomerInfo({
      originalAppUserId: 'mlg1_x',
      entitlements: { active: { premium: { isActive: true } }, all: {} },
      activeSubscriptions: ['p1'],
      allPurchasedProductIdentifiers: ['p1'],
      latestExpirationDate: '2026-12-01T00:00:00Z',
      requestDate: 'r',
      firstSeen: 'f',
      managementURL: 'https://m',
    });

    expect(s.originalAppUserId).toBe('mlg1_x');
    expect(s.activeEntitlementIds).toEqual(['premium']);
    expect(s.latestExpirationDate).toBe('2026-12-01T00:00:00Z');
    expect(s.managementURL).toBe('https://m');
  });
});

describe('summarizePurchase', () => {
  it('extracts the transaction identifier', () => {
    const s = summarizePurchase({
      productIdentifier: 'monthly',
      transaction: { transactionIdentifier: 'tx1' },
      customerInfo: { originalAppUserId: 'a' },
    });

    expect(s.productIdentifier).toBe('monthly');
    expect(s.transactionIdentifier).toBe('tx1');
    expect(s.customerInfo.originalAppUserId).toBe('a');
    expect(summarizePurchase(null).transactionIdentifier).toBeNull();
  });
});

describe('serializeLog', () => {
  it('orders entries by id with stable keys', () => {
    const a = makeLogEntry({ id: 2, action: 'restore', startedAtIso: 't' });
    const b = makeLogEntry({ id: 1, action: 'configure', startedAtIso: 't', result: { x: 1n } });
    const parsed = JSON.parse(serializeLog([a, b]));

    expect(parsed.map((e: { id: number }) => e.id)).toEqual([1, 2]);
    expect(parsed[0].result).toEqual({ x: '1' });
    expect(Object.keys(parsed[0])).toEqual([
      'id',
      'action',
      'startedAtIso',
      'durationMs',
      'ok',
      'rcId',
      'result',
      'error',
    ]);
  });
});
