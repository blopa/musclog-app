import AsyncStorage from '@react-native-async-storage/async-storage';

export const getStoredEncryptionKey = (key: string): Promise<null | string> => {
  return AsyncStorage.getItem(key);
};

export const storeEncryptionKey = (key: string, value: string): Promise<void> => {
  return AsyncStorage.setItem(key, value);
};
