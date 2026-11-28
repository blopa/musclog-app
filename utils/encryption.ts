import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

import { ENCRYPTION_KEY, ENCRYPTION_KEY_SEEN } from '@/constants/database';

import { getStoredEncryptionKey, storeEncryptionKey } from './encryptionKeyStorage';

const encryptionKeys = new Map<string, string>();
const encryptionKeyLoads = new Map<string, Promise<string>>();

/** How long to wait before asking the key store again for a key this install has had. */
export const KEY_RETRY_DELAY_MS = 500;

/**
 * Making a new key leaves everything encrypted with the old one unreadable, so a store that
 * suddenly answers "nothing" for a key this install has had is asked once more first, and the
 * loss is reported if it holds.
 */
const readAgainIfSeenBefore = async (storageKey: string): Promise<null | string> => {
  if (storageKey !== ENCRYPTION_KEY || !(await AsyncStorage.getItem(ENCRYPTION_KEY_SEEN))) {
    return null;
  }

  await new Promise((resolve) => setTimeout(resolve, KEY_RETRY_DELAY_MS));
  const again = await getStoredEncryptionKey(storageKey);
  if (!again) {
    // Loaded here, on the rare fault only, so this module stays free of the crash reporter.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureMessage } = require('./sentry') as typeof import('./sentry');
    captureMessage('encryption-key-missing');
  }

  return again;
};

const rememberKey = (storageKey: string, key: string) => {
  encryptionKeys.set(storageKey, key);
  if (storageKey === ENCRYPTION_KEY) {
    AsyncStorage.setItem(ENCRYPTION_KEY_SEEN, 'true')?.catch(() => undefined);
  }
};

const loadOrCreateEncryptionKey = async (length: number, storageKey: string): Promise<string> => {
  const existingEncryptionKey =
    (await getStoredEncryptionKey(storageKey)) || (await readAgainIfSeenBefore(storageKey));
  if (existingEncryptionKey) {
    rememberKey(storageKey, existingEncryptionKey);
    return existingEncryptionKey;
  }

  const randomWords = CryptoJS.lib.WordArray.random(length);
  const encryption = CryptoJS.enc.Hex.stringify(randomWords);
  await storeEncryptionKey(storageKey, encryption);
  rememberKey(storageKey, encryption);
  return encryption;
};

export const getEncryptionKey = async (
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  const cached = encryptionKeys.get(storageKey);
  if (cached) {
    return cached;
  }

  const pending = encryptionKeyLoads.get(storageKey);
  if (pending) {
    return pending;
  }

  const load = loadOrCreateEncryptionKey(length, storageKey);

  encryptionKeyLoads.set(storageKey, load);
  try {
    return await load;
  } finally {
    if (encryptionKeyLoads.get(storageKey) === load) {
      encryptionKeyLoads.delete(storageKey);
    }
  }
};

export const encryptDatabaseValue = async (
  text: string,
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  if (!text || parseFloat(text) === 0) {
    return '';
  }

  const encryptionKey = await getEncryptionKey(length, storageKey);
  return encrypt(text, encryptionKey);
};

export const encrypt = async (text: string, encryptionKey: string): Promise<string> => {
  return CryptoJS.AES.encrypt(text, encryptionKey).toString();
};

export const decryptDatabaseValue = async (
  cipherText: string | undefined,
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  if (!cipherText) {
    return '';
  }

  const encryptionKey = await getEncryptionKey(length, storageKey);
  return decrypt(cipherText, encryptionKey);
};

export const decrypt = async (
  cipherText: string | undefined,
  encryptionKey: string
): Promise<string> => {
  if (!cipherText) {
    return '';
  }

  const bytes = CryptoJS.AES.decrypt(cipherText, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};
