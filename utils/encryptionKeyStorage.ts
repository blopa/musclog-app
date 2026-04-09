import * as SecureStore from 'expo-secure-store';

export const getStoredEncryptionKey = (key: string): Promise<null | string> => {
  return SecureStore.getItemAsync(key);
};

export const storeEncryptionKey = (key: string, value: string): Promise<void> => {
  return SecureStore.setItemAsync(key, value);
};
