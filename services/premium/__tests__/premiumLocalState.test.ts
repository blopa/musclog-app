import AsyncStorage from '@react-native-async-storage/async-storage';

import { PREMIUM_DEVICE_STATE } from '@/constants/misc';
import {
  EMPTY_PREMIUM_LOCAL_STATE,
  clearPremiumLocalState,
  loadPremiumLocalState,
  parsePremiumLocalState,
  savePremiumLocalState,
} from '@/services/premium/premiumLocalState';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const RC_ID = `mlg1_${'ab'.repeat(32)}`;

let saved: Map<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  saved = new Map();
  storage.getItem.mockImplementation(async (key: string) => saved.get(key) ?? null);
  storage.setItem.mockImplementation(async (key: string, value: string) => {
    saved.set(key, value);
  });
  storage.removeItem.mockImplementation(async (key: string) => {
    saved.delete(key);
  });
});

describe('round trip', () => {
  it('loads back what was saved', async () => {
    const written = await savePremiumLocalState({
      rcId: RC_ID,
      enrolledAtMs: 1_700_000_000_000,
      lastStatus: 'exhausted',
      usedPct: 42,
      resetsAt: '2026-12-01T00:00:00.000Z',
      devices: { count: 1, max: 3 },
    });

    expect(await loadPremiumLocalState()).toEqual(written);
    expect(written.lastStatus).toBe('exhausted');
    expect(written.devices).toEqual({ count: 1, max: 3 });
  });

  it('merges a patch into the existing state', async () => {
    await savePremiumLocalState({ rcId: RC_ID, usedPct: 10 });
    const next = await savePremiumLocalState({ usedPct: 55 });

    expect(next.rcId).toBe(RC_ID);
    expect(next.usedPct).toBe(55);
  });

  it('returns the empty state when nothing is stored', async () => {
    expect(await loadPremiumLocalState()).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
  });
});

describe('parsePremiumLocalState tolerance', () => {
  it.each([
    ['null', null],
    ['bad JSON', '{not json'],
    ['a JSON array', '[1,2]'],
    ['a JSON string', '"hello"'],
  ])('returns empty for %s', (_label, raw) => {
    expect(parsePremiumLocalState(raw)).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
  });

  it('keeps valid fields and resets wrong types individually', () => {
    const parsed = parsePremiumLocalState(
      JSON.stringify({
        rcId: RC_ID,
        enrolledAtMs: '2026',
        removed: 'yes',
        lastStatus: 'maybe',
        usedPct: 50,
        resetsAt: 12,
      })
    );

    expect(parsed).toEqual({
      ...EMPTY_PREMIUM_LOCAL_STATE,
      rcId: RC_ID,
      usedPct: 50,
    });
  });

  it.each([
    ['rcId without prefix', { rcId: 'ab'.repeat(32) }],
    ['rcId with uppercase hex', { rcId: `mlg1_${'AB'.repeat(32)}` }],
    ['rcId too short', { rcId: 'mlg1_abc' }],
    ['usedPct above 100', { usedPct: 101 }],
    ['usedPct negative', { usedPct: -1 }],
    ['negative enrolledAtMs', { enrolledAtMs: -5 }],
    ['non-finite usedPct', { usedPct: null }],
    ['fractional device count', { devices: { count: 1.5, max: 3 } }],
    ['negative device count', { devices: { count: -1, max: 3 } }],
    ['count above max', { devices: { count: 4, max: 3 } }],
    ['devices not an object', { devices: 3 }],
    ['unparseable resetsAt', { resetsAt: 'next tuesday' }],
    ['empty resetsAt', { resetsAt: '' }],
  ])('drops %s to its empty value', (_label, fields) => {
    const parsed = parsePremiumLocalState(JSON.stringify(fields));

    expect(parsed).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
  });

  it('accepts boundary values', () => {
    const parsed = parsePremiumLocalState(
      JSON.stringify({ usedPct: 100, devices: { count: 3, max: 3 }, enrolledAtMs: 0 })
    );

    expect(parsed.usedPct).toBe(100);
    expect(parsed.devices).toEqual({ count: 3, max: 3 });
    expect(parsed.enrolledAtMs).toBe(0);
  });

  it('never returns a session token, even when one is stored', async () => {
    saved.set(
      PREMIUM_DEVICE_STATE,
      JSON.stringify({ rcId: RC_ID, session_token: 'secret-token-value' })
    );

    const loaded = await loadPremiumLocalState();
    const patched = await savePremiumLocalState({ usedPct: 5 });

    expect(JSON.stringify(loaded)).not.toContain('secret-token-value');
    expect(JSON.stringify(patched)).not.toContain('secret-token-value');
    expect(saved.get(PREMIUM_DEVICE_STATE)).not.toContain('session_token');
    expect(saved.get(PREMIUM_DEVICE_STATE)).not.toContain('secret-token-value');
  });
});

describe('concurrent saves', () => {
  it('lands both patches when they run at the same time', async () => {
    await Promise.all([
      savePremiumLocalState({ rcId: RC_ID }),
      savePremiumLocalState({ usedPct: 30, lastStatus: 'active' }),
    ]);

    const loaded = await loadPremiumLocalState();
    expect(loaded.rcId).toBe(RC_ID);
    expect(loaded.usedPct).toBe(30);
    expect(loaded.lastStatus).toBe('active');
  });
});

describe('storage failures', () => {
  it('does not throw when getItem throws', async () => {
    storage.getItem.mockRejectedValue(new Error('disk gone'));

    await expect(loadPremiumLocalState()).resolves.toEqual(EMPTY_PREMIUM_LOCAL_STATE);
    await expect(savePremiumLocalState({ usedPct: 1 })).resolves.toMatchObject({ usedPct: 1 });
  });

  it('does not throw when setItem throws', async () => {
    storage.setItem.mockRejectedValue(new Error('quota'));

    await expect(savePremiumLocalState({ removed: true })).resolves.toMatchObject({
      removed: true,
    });
  });

  it('does not throw when removeItem throws', async () => {
    storage.removeItem.mockRejectedValue(new Error('locked'));

    await expect(clearPremiumLocalState()).resolves.toBeUndefined();
  });

  it('keeps the queue working after a failed save', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('quota'));
    await savePremiumLocalState({ usedPct: 1 });

    const next = await savePremiumLocalState({ usedPct: 2 });
    expect(next.usedPct).toBe(2);
  });
});

describe('clear and key', () => {
  it('removes the stored state', async () => {
    await savePremiumLocalState({ rcId: RC_ID });
    await clearPremiumLocalState();

    expect(saved.has(PREMIUM_DEVICE_STATE)).toBe(false);
    expect(await loadPremiumLocalState()).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
  });

  it('stores under exactly PREMIUM_DEVICE_STATE', async () => {
    await savePremiumLocalState({ usedPct: 9 });

    expect(storage.setItem).toHaveBeenCalledWith(PREMIUM_DEVICE_STATE, expect.any(String));
    expect(Array.from(saved.keys())).toEqual([PREMIUM_DEVICE_STATE]);
  });
});
