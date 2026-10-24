import { decryptDatabaseValue, encryptDatabaseValue, getEncryptionKey } from '@/utils/encryption';

/**
 * Cycle records keep everything personal in one encrypted JSON string. This is the only module
 * that turns it into text and back, so no other file ever sees ciphertext.
 */
export async function primeCycleEncryption(): Promise<void> {
  // Resolved before a writer opens so the keystore read never happens while holding the write lock.
  await getEncryptionKey();
}

export async function encryptCyclePayload(payload: object): Promise<string> {
  return encryptDatabaseValue(JSON.stringify(payload));
}

export async function decryptCyclePayload<T extends object>(
  cipher: string | null | undefined
): Promise<T | null> {
  if (!cipher) {
    return null;
  }

  try {
    const parsed = JSON.parse(await decryptDatabaseValue(cipher));

    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    // An unreadable row is skipped rather than crashing every screen that lists cycle history.
    return null;
  }
}

/** Plaintext payload for a backup; empty when it cannot be read (the row is then exported as-is). */
export async function decryptCycleText(cipher: string | null | undefined): Promise<string | null> {
  if (!cipher) {
    return null;
  }

  try {
    return await decryptDatabaseValue(cipher);
  } catch {
    return null;
  }
}

export function encryptCycleText(text: string): Promise<string> {
  return encryptDatabaseValue(text);
}
