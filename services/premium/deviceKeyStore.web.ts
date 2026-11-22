// Web has no secure key storage: Premium identity is native only.
import type { SignPurpose } from '@/utils/premium/deviceKeyCrypto';

export const DEVICE_KEY_STORE_OPTIONS = { keychainAccessible: undefined };

export const DEVICE_KEY_STORAGE_DESCRIPTION = 'Not available on web.';

export type DeviceKeyInfo = {
  rcId: string;
  publicKeyHex: string;
  createdAtMs: number;
  storage: string;
};

const unavailable = () => Promise.reject(new Error('Premium identity is not available on web'));

export async function loadDeviceKeyInfo(): Promise<DeviceKeyInfo | null> {
  return null;
}

export function getOrCreateDeviceKey(): Promise<DeviceKeyInfo> {
  return unavailable();
}

export function resetDeviceKey(): Promise<DeviceKeyInfo> {
  return unavailable();
}

export function signWithDeviceKey(
  _purpose: SignPurpose,
  _nonce: string,
  _body?: Uint8Array
): Promise<{ rcId: string; publicKeyHex: string; signatureHex: string }> {
  return unavailable();
}
