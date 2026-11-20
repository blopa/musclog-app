const mockStore = new Map<string, string>();
const mockOptionCalls: unknown[] = [];
let mockRandomCounter = 0;

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (key: string, options: unknown) => {
    mockOptionCalls.push(options);

    return mockStore.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string, options: unknown) => {
    mockOptionCalls.push(options);
    await Promise.resolve();
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string, options: unknown) => {
    mockOptionCalls.push(options);
    mockStore.delete(key);
  }),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn(() => {
    mockRandomCounter += 1;

    return Uint8Array.from({ length: 48 }, (_, i) => ((i + mockRandomCounter * 7) % 250) + 1);
  }),
}));

import {
  DEVICE_KEY_STORE_OPTIONS,
  getOrCreateDeviceKey,
  loadDeviceKeyInfo,
  resetDeviceKey,
  signWithDeviceKey,
} from '../deviceKeyStore';
import { hexToBytes, verifyDeviceSignature } from '@/utils/premium/deviceKeyCrypto';

beforeEach(() => {
  mockStore.clear();
  mockOptionCalls.length = 0;
  mockRandomCounter = 0;
});

describe('deviceKeyStore', () => {
  it('returns null and creates nothing when empty', async () => {
    expect(await loadDeviceKeyInfo()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('creates one key for concurrent calls and keeps it afterwards', async () => {
    const [a, b] = await Promise.all([getOrCreateDeviceKey(), getOrCreateDeviceKey()]);
    expect(a.rcId).toBe(b.rcId);
    expect(mockRandomCounter).toBe(1);
    const again = await getOrCreateDeviceKey();
    expect(again.rcId).toBe(a.rcId);
    expect(again.createdAtMs).toBe(a.createdAtMs);
    expect(a.rcId).toHaveLength(69);
  });

  it('passes the keychain option on every call', async () => {
    await getOrCreateDeviceKey();
    await signWithDeviceKey('session', 'n');
    await resetDeviceKey();
    expect(mockOptionCalls.length).toBeGreaterThan(0);
    for (const options of mockOptionCalls) {
      expect(options).toEqual(DEVICE_KEY_STORE_OPTIONS);
      expect(options).toEqual({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
    }
  });

  it('reset yields a different rc_id', async () => {
    const first = await getOrCreateDeviceKey();
    const next = await resetDeviceKey();
    expect(next.rcId).not.toBe(first.rcId);
    expect((await loadDeviceKeyInfo())?.rcId).toBe(next.rcId);
  });

  it('signs messages the verifier accepts', async () => {
    const info = await getOrCreateDeviceKey();
    const body = new TextEncoder().encode('payload');
    const out = await signWithDeviceKey('enroll', 'nonce-9', body);
    expect(out.rcId).toBe(info.rcId);
    expect(out.publicKeyHex).toBe(info.publicKeyHex);
    expect(
      verifyDeviceSignature(
        hexToBytes(out.publicKeyHex),
        'enroll',
        out.rcId,
        'nonce-9',
        hexToBytes(out.signatureHex),
        body
      )
    ).toBe(true);
  });

  it('throws when signing without a key', async () => {
    await expect(signWithDeviceKey('session', 'n')).rejects.toThrow(/No premium device key/);
  });

  it('throws on a corrupted secret and does not overwrite it', async () => {
    mockStore.set('premium_device_key_v1', 'not-hex');
    mockStore.set('premium_device_key_created_at_v1', '123');
    await expect(loadDeviceKeyInfo()).rejects.toThrow(/damaged/);
    await expect(getOrCreateDeviceKey()).rejects.toThrow(/damaged/);
    expect(mockStore.get('premium_device_key_v1')).toBe('not-hex');
    mockStore.set('premium_device_key_v1', '11'.repeat(32));
    mockStore.delete('premium_device_key_created_at_v1');
    await expect(loadDeviceKeyInfo()).rejects.toThrow(/damaged/);
  });
});
