import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const getStoredEncryptionKey = async (key: string): Promise<null | string> => {
  const secureValue = await SecureStore.getItemAsync(key);
  if (secureValue) {
    return secureValue;
  }

  // Fallback: check AsyncStorage for keys stored before the SecureStore migration.
  // Migrate on-the-fly to avoid a race condition where getEncryptionKey() generates
  // a new key before the Migrations.tsx useEffect has had a chance to run.
  const legacyValue = await AsyncStorage.getItem(key);
  if (legacyValue) {
    await SecureStore.setItemAsync(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  }

  return null;
};

export const storeEncryptionKey = (key: string, value: string): Promise<void> => {
  return SecureStore.setItemAsync(key, value);
};
