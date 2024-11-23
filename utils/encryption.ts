import 'react-native-get-random-values';
import { ENCRYPTION_KEY } from '@/constants/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

let encryptionKey: null | string = null;

export const getEncryptionKey = async (length = 32): Promise<string> => {
    if (encryptionKey) {
        return encryptionKey;
    }

    const existingEncryptionKey = await AsyncStorage.getItem(ENCRYPTION_KEY);
    if (existingEncryptionKey) {
        encryptionKey = existingEncryptionKey;
        return existingEncryptionKey;
    }

    const randomWords = CryptoJS.lib.WordArray.random(length);
    const encryption = CryptoJS.enc.Hex.stringify(randomWords);
    await AsyncStorage.setItem(ENCRYPTION_KEY, encryption);
    encryptionKey = encryption;

    return encryption;
};

export const encryptDatabaseValue = async (text: string): Promise<string> => {
    if (!text || parseFloat(text) === 0) {
        return '';
    }

    const encryptionKey = await getEncryptionKey();
    return encrypt(text, encryptionKey);
};

export const encrypt = async (text: string, encryptionKey: string): Promise<string> => {
    return CryptoJS.AES.encrypt(text, encryptionKey).toString();
};

export const decryptDatabaseValue = async (cipherText: string | undefined): Promise<string> => {
    if (!cipherText) {
        return '';
    }

    const encryptionKey = await getEncryptionKey();
    return decrypt(cipherText, encryptionKey);
};

export const decrypt = async (cipherText: string | undefined, encryptionKey: string): Promise<string> => {
    if (!cipherText) {
        return '';
    }

    const bytes = CryptoJS.AES.decrypt(cipherText, encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
};
