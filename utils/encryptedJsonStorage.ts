import AsyncStorage from '@react-native-async-storage/async-storage';

import { decryptOptionalString, encryptOptionalString } from '@/database/encryptionHelpers';

/**
 * Small JSON records kept in AsyncStorage but encrypted with the app's database key. Used for
 * onboarding drafts, which hold a birthday, body measurements or a conversation before the
 * profile exists. A value that no longer decrypts or parses reads back as `null`.
 */
export async function readEncryptedJson(key: string): Promise<unknown | null> {
  const stored = await AsyncStorage.getItem(key);
  if (!stored) {
    return null;
  }

  try {
    const plain = await decryptOptionalString(stored);
    return plain ? (JSON.parse(plain) as unknown) : null;
  } catch {
    return null;
  }
}

export async function writeEncryptedJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, await encryptOptionalString(JSON.stringify(value)));
}
