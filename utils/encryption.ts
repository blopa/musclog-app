import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

import { ENCRYPTION_KEY } from '@/constants/database';

let encryptionKey: null | string = null;

export const getEncryptionKey = async (
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  if (encryptionKey) {
    return encryptionKey;
  }

  const existingEncryptionKey = await AsyncStorage.getItem(storageKey);
  if (existingEncryptionKey) {
    encryptionKey = existingEncryptionKey;
    return existingEncryptionKey;
  }

  const randomWords = CryptoJS.lib.WordArray.random(length);
  const encryption = CryptoJS.enc.Hex.stringify(randomWords);
  await AsyncStorage.setItem(storageKey, encryption);
  encryptionKey = encryption;

  return encryption;
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
