const {
  sanitize,
  stableStringify,
  diffByLookupKey,
  needsExplicitApproval,
  isEmptyDiff,
  cliError,
  requireEnv,
  buildQuery,
  numberOrNull,
  formatNumber,
  isUnavailable,
  tryRequest,
  formatJson,
  runCli,
} = require('../infra/lib');
const { planFrom, managedView } = require('../infra/revenuecat');

describe('sanitize', () => {
  it('redacts secret-looking fields and values, and drops personal fields', () => {
    const out = sanitize({
      label: 'musclog',
      key: 'sk-or-v1-abcdef123456',
      api_key: 'abc',
      note: 'token sk-or-mgmt-zzzz inside',
      owner: { email: 'a@b.c', name: 'Premium' },
      disabled: false,
    });
    expect(out).toEqual({
      label: 'musclog',
      key: '<redacted>',
      api_key: '<redacted>',
      note: 'token <redacted> inside',
      owner: { name: 'Premium' },
      disabled: false,
    });
  });
});

describe('sanitize account identifiers', () => {
  it('drops the creator id and redacts the key hash', () => {
    expect(sanitize({ name: 'k', creator_user_id: 'user_x', hash: 'abc123' })).toEqual({
      name: 'k',
      hash: '<redacted>',
    });
  });
});

describe('diffByLookupKey', () => {
  const live = [
    { id: 'e1', lookup_key: 'premium', display_name: 'Premium' },
    { id: 'e2', lookup_key: 'legacy', display_name: 'Legacy' },
  ];

  it('is empty and idempotent when desired equals live, and ignores unnamed fields', () => {
    const d = diffByLookupKey([{ lookup_key: 'premium', display_name: 'Premium' }], live);
    expect(isEmptyDiff(d)).toBe(true);
    expect(d.same).toEqual(['premium']);
  });

  it('never deletes: live-only items are reported as unmanaged', () => {
    const d = diffByLookupKey([{ lookup_key: 'premium', display_name: 'Premium' }], live);
    expect(d.unmanaged).toEqual(['legacy']);
  });

  it('reports creates and field-level updates', () => {
    const d = diffByLookupKey(
      [
        { lookup_key: 'premium', display_name: 'Musclog Iron' },
        { lookup_key: 'new', display_name: 'New' },
      ],
      live
    );
    expect(d.create).toEqual([{ lookup_key: 'new', display_name: 'New' }]);
    expect(d.update).toEqual([
      {
        lookup_key: 'premium',
        id: 'e1',
        changes: { display_name: { from: 'Premium', to: 'Musclog Iron' } },
      },
    ]);
  });

  it('flags pricing-related fields for explicit approval', () => {
    const d = diffByLookupKey(
      [{ lookup_key: 'p', price_amount: 2 }],
      [{ id: 'x', lookup_key: 'p', price_amount: 1 }]
    );
    expect(needsExplicitApproval(d)).toEqual(['p.price_amount']);
  });
});

describe('stableStringify', () => {
  it('is key-order independent', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe(
      stableStringify({ a: { c: 2, d: 1 }, b: 1 })
    );
  });
});

describe('revenuecat managed view', () => {
  it('keeps only the fields a desired file may manage', () => {
    expect(
      managedView('entitlements', { id: 'x', lookup_key: 'p', display_name: 'P', created_at: 1 })
    ).toEqual({
      lookup_key: 'p',
      display_name: 'P',
    });
    expect(typeof planFrom).toBe('function');
  });
});

describe('shared CLI, HTTP and formatting helpers', () => {
  it('creates errors with exitCode and checks required env vars', () => {
    const err = cliError('bad flag', 2);
    expect(err.message).toBe('bad flag');
    expect(err.exitCode).toBe(2);

    expect(() => requireEnv(undefined, 'TEST_INFRA_VAR', 'missing var')).toThrow('missing var');
    expect(() => requireEnv('', 'TEST_INFRA_VAR')).toThrow('Set TEST_INFRA_VAR.');
    expect(requireEnv('ok', 'TEST_INFRA_VAR')).toBe('ok');
  });

  it('formats queries, numbers, JSON and unavailable responses', async () => {
    expect(buildQuery({ a: null, b: undefined, tag: ['x', 'y'], n: 3 })).toBe('?tag=x&tag=y&n=3');
    expect(numberOrNull(42)).toBe(42);
    expect(numberOrNull(Number.NaN)).toBeNull();
    expect(formatNumber(null)).toBe('n/a');
    expect(formatNumber(1.2345, 2)).toBe('1.23');
    expect(isUnavailable({ _unavailable: 'down' })).toBe(true);
    expect(isUnavailable({ ok: true })).toBe(false);
    expect(formatJson({ a: 1 }, true)).toBe('{"a":1}');
    expect(formatJson({ a: 1 }, false)).toBe('{\n  "a": 1\n}');

    await expect(tryRequest(async () => ({ ok: true }))).resolves.toEqual({ ok: true });
    await expect(
      tryRequest(async () => {
        throw new Error('HTTP 503');
      })
    ).resolves.toEqual({ _unavailable: 'HTTP 503' });
  });

  it('dispatches CLI commands and handles unknown commands or errors', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = jest.fn(async (args: string[]) => args);

    try {
      await expect(
        runCli({ report: handler }, 'usage: test', ['report', '--json'])
      ).resolves.toEqual(['--json']);
      expect(exitSpy).not.toHaveBeenCalled();

      await runCli({ report: handler }, 'usage: test', ['bad']);
      expect(errSpy).toHaveBeenCalledWith('usage: test');
      expect(exitSpy).toHaveBeenCalledWith(2);

      exitSpy.mockClear();
      await runCli(
        {
          fail: async () => {
            throw cliError('boom', 4);
          },
        },
        'usage: test',
        ['fail']
      );
      expect(errSpy).toHaveBeenCalledWith('error: boom');
      expect(exitSpy).toHaveBeenCalledWith(4);
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
