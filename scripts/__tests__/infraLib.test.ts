const {
  sanitize,
  stableStringify,
  diffByLookupKey,
  needsExplicitApproval,
  isEmptyDiff,
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
        { lookup_key: 'premium', display_name: 'Musclog Premium' },
        { lookup_key: 'new', display_name: 'New' },
      ],
      live
    );
    expect(d.create).toEqual([{ lookup_key: 'new', display_name: 'New' }]);
    expect(d.update).toEqual([
      {
        lookup_key: 'premium',
        id: 'e1',
        changes: { display_name: { from: 'Premium', to: 'Musclog Premium' } },
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
