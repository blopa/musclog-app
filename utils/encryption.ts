import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

let encryptionKey: null | string = null;

export const getEncryptionKey = async (storageKey: string, length = 32): Promise<string> => {
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

export const encryptDatabaseValue = async (storageKey: string, text: string): Promise<string> => {
  if (!text || parseFloat(text) === 0) {
    return '';
  }

  const encryptionKey = await getEncryptionKey(storageKey);
  return encrypt(text, encryptionKey);
};

export const encrypt = async (text: string, encryptionKey: string): Promise<string> => {
  return CryptoJS.AES.encrypt(text, encryptionKey).toString();
};

export const decryptDatabaseValue = async (
  storageKey: string,
  cipherText: string | undefined
): Promise<string> => {
  if (!cipherText) {
    return '';
  }

  const encryptionKey = await getEncryptionKey(storageKey);
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
