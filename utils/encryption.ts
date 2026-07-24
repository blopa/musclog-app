import 'react-native-get-random-values';

import CryptoJS from 'crypto-js';

import { ENCRYPTION_KEY } from '@/constants/database';

import { getStoredEncryptionKey, storeEncryptionKey } from './encryptionKeyStorage';

const encryptionKeys = new Map<string, string>();
const encryptionKeyLoads = new Map<string, Promise<string>>();

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

  const load = (async () => {
    const existingEncryptionKey = await getStoredEncryptionKey(storageKey);
    if (existingEncryptionKey) {
      encryptionKeys.set(storageKey, existingEncryptionKey);
      return existingEncryptionKey;
    }

    const randomWords = CryptoJS.lib.WordArray.random(length);
    const encryption = CryptoJS.enc.Hex.stringify(randomWords);
    await storeEncryptionKey(storageKey, encryption);
    encryptionKeys.set(storageKey, encryption);
    return encryption;
  })();

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
