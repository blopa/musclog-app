// Device key storage for Musclog Premium (plan 6.1). Native only (web stub: deviceKeyStore.web.ts).
import { p256 } from '@noble/curves/nist.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import {
  bytesToHex,
  deriveRcId,
  generateDeviceKey,
  hexToBytes,
  signDeviceMessage,
  type SignPurpose,
} from '@/utils/premium/deviceKeyCrypto';

export const DEVICE_KEY_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const DEVICE_KEY_STORAGE_DESCRIPTION =
  'expo-secure-store (iOS keychain WHEN_UNLOCKED_THIS_DEVICE_ONLY, Android Keystore-encrypted shared preferences); the key is a 32-byte software key readable from JS memory.';

export type DeviceKeyInfo = {
  rcId: string;
  publicKeyHex: string;
  createdAtMs: number;
  storage: string;
};

const SECRET_KEY_NAME = 'premium_device_key_v1';
const CREATED_AT_KEY_NAME = 'premium_device_key_created_at_v1';

let inFlightCreate: Promise<DeviceKeyInfo> | null = null;

type StoredKey = { secretKey: Uint8Array; createdAtMs: number };

async function readStoredKey(): Promise<StoredKey | null> {
  const secretHex = await SecureStore.getItemAsync(SECRET_KEY_NAME, DEVICE_KEY_STORE_OPTIONS);
  const createdRaw = await SecureStore.getItemAsync(CREATED_AT_KEY_NAME, DEVICE_KEY_STORE_OPTIONS);

  if (secretHex === null && createdRaw === null) {
    return null;
  }

  if (secretHex === null) {
    throw new Error('Premium device key is damaged: the secret is missing');
  }

  let secretKey: Uint8Array;
  try {
    secretKey = hexToBytes(secretHex);
  } catch {
    throw new Error('Premium device key is damaged: the secret is not valid hex');
  }

  if (secretKey.length !== 32) {
    throw new Error('Premium device key is damaged: the secret has the wrong length');
  }

  const createdAtMs = createdRaw === null ? NaN : Number(createdRaw);
  if (!Number.isFinite(createdAtMs)) {
    throw new Error('Premium device key is damaged: the creation time is missing');
  }

  return { secretKey, createdAtMs };
}

function infoFor(stored: StoredKey): DeviceKeyInfo {
  const publicKey = p256.getPublicKey(stored.secretKey, false);

  return {
    rcId: deriveRcId(publicKey),
    publicKeyHex: bytesToHex(publicKey),
    createdAtMs: stored.createdAtMs,
    storage: DEVICE_KEY_STORAGE_DESCRIPTION,
  };
}

async function createKey(): Promise<DeviceKeyInfo> {
  const { secretKey } = generateDeviceKey(Crypto.getRandomBytes(48));
  const createdAtMs = Date.now();
  await SecureStore.setItemAsync(SECRET_KEY_NAME, bytesToHex(secretKey), DEVICE_KEY_STORE_OPTIONS);
  await SecureStore.setItemAsync(
    CREATED_AT_KEY_NAME,
    String(createdAtMs),
    DEVICE_KEY_STORE_OPTIONS
  );

  return infoFor({ secretKey, createdAtMs });
}

export async function loadDeviceKeyInfo(): Promise<DeviceKeyInfo | null> {
  const stored = await readStoredKey();

  return stored ? infoFor(stored) : null;
}

export function getOrCreateDeviceKey(): Promise<DeviceKeyInfo> {
  if (inFlightCreate) {
    return inFlightCreate;
  }

  const run = (async () => {
    const existing = await loadDeviceKeyInfo();

    return existing ?? createKey();
  })();
  inFlightCreate = run;
  const clear = () => {
    if (inFlightCreate === run) {
      inFlightCreate = null;
    }
  };

  run.then(clear, clear);

  return run;
}

export async function resetDeviceKey(): Promise<DeviceKeyInfo> {
  if (inFlightCreate) {
    await inFlightCreate.catch(() => undefined);
  }

  await SecureStore.deleteItemAsync(SECRET_KEY_NAME, DEVICE_KEY_STORE_OPTIONS);
  await SecureStore.deleteItemAsync(CREATED_AT_KEY_NAME, DEVICE_KEY_STORE_OPTIONS);

  return createKey();
}

export async function signWithDeviceKey(
  purpose: SignPurpose,
  nonce: string,
  body?: Uint8Array
): Promise<{ rcId: string; publicKeyHex: string; signatureHex: string }> {
  const stored = await readStoredKey();
  if (!stored) {
    throw new Error('No premium device key exists; create one first');
  }

  const publicKey = p256.getPublicKey(stored.secretKey, false);
  const rcId = deriveRcId(publicKey);
  const signature = signDeviceMessage(stored.secretKey, purpose, rcId, nonce, body);

  return { rcId, publicKeyHex: bytesToHex(publicKey), signatureHex: bytesToHex(signature) };
}
