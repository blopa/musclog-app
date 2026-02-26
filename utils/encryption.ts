import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

import { ENCRYPTION_KEY } from '../constants/database';

let encryptionKey: null | string = null;

export const getEncryptionKey = async (
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  console.log('getEncryptionKey - called, existing key:', encryptionKey ? 'exists' : 'null');
  if (encryptionKey) {
    console.log('getEncryptionKey - returning cached key');
    return encryptionKey;
  }

  const existingEncryptionKey = await AsyncStorage.getItem(storageKey);
  console.log('getEncryptionKey - key from storage:', existingEncryptionKey ? 'exists' : 'null');
  if (existingEncryptionKey) {
    encryptionKey = existingEncryptionKey;
    return existingEncryptionKey;
  }

  const randomWords = CryptoJS.lib.WordArray.random(length);
  const encryption = CryptoJS.enc.Hex.stringify(randomWords);
  await AsyncStorage.setItem(storageKey, encryption);
  encryptionKey = encryption;
  console.log('getEncryptionKey - created new key:', encryption);

  return encryption;
};

export const encryptDatabaseValue = async (
  text: string,
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  console.log('encryptDatabaseValue - input:', text, 'type:', typeof text);
  if (!text || parseFloat(text) === 0) {
    console.log('encryptDatabaseValue - returning empty string for:', text);
    return '';
  }

  const encryptionKey = await getEncryptionKey(length, storageKey);
  const result = await encrypt(text, encryptionKey);
  console.log('encryptDatabaseValue - encrypted result:', result);
  return result;
};

export const encrypt = async (text: string, encryptionKey: string): Promise<string> => {
  return CryptoJS.AES.encrypt(text, encryptionKey).toString();
};

export const decryptDatabaseValue = async (
  cipherText: string | undefined,
  length = 32,
  storageKey: string = ENCRYPTION_KEY
): Promise<string> => {
  console.log('decryptDatabaseValue - input:', cipherText);
  if (!cipherText) {
    console.log('decryptDatabaseValue - returning empty string, no cipherText');
    return '';
  }

  const encryptionKey = await getEncryptionKey(length, storageKey);
  const result = await decrypt(cipherText, encryptionKey);
  console.log('decryptDatabaseValue - decrypted result:', result);
  return result;
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
