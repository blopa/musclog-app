import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  deleteStoredEncryptionKey,
  getStoredEncryptionKey,
  storeEncryptionKey,
} from '@/utils/encryptionKeyStorage';

// The manual mock in `__mocks__/expo-secure-store.js` is backed by a real in-memory Map,
// so these are genuine round-trips rather than call-argument assertions.
const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const KEY = 'musclog-encryption-key';

describe('encryptionKeyStorage', () => {
  beforeEach(async () => {
    secureStore.clear();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('round-trips a key through SecureStore', async () => {
    await storeEncryptionKey(KEY, 'abc123');

    await expect(getStoredEncryptionKey(KEY)).resolves.toBe('abc123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, 'abc123');
  });

  it('returns null when nothing has ever been stored (fresh install)', async () => {
    await expect(getStoredEncryptionKey(KEY)).resolves.toBeNull();
    // No legacy value either, so nothing must be written back.
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('deletes the key from SecureStore', async () => {
    await storeEncryptionKey(KEY, 'abc123');
    await deleteStoredEncryptionKey(KEY);

    await expect(getStoredEncryptionKey(KEY)).resolves.toBeNull();
  });

  // Keys written before the SecureStore migration live in AsyncStorage. Migrating on read
  // (rather than waiting for the Migrations.tsx effect) is what prevents getEncryptionKey()
  // from generating a *second* key and rendering already-encrypted data undecryptable.
  it('migrates a legacy AsyncStorage key into SecureStore on first read', async () => {
    await AsyncStorage.setItem(KEY, 'legacy-key');

    await expect(getStoredEncryptionKey(KEY)).resolves.toBe('legacy-key');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, 'legacy-key');
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('serves the migrated key from SecureStore on subsequent reads without touching AsyncStorage again', async () => {
    await AsyncStorage.setItem(KEY, 'legacy-key');
    await getStoredEncryptionKey(KEY);
    jest.clearAllMocks();

    await expect(getStoredEncryptionKey(KEY)).resolves.toBe('legacy-key');

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  // SecureStore always wins: if both stores somehow hold a value, migrating the legacy one
  // over the top would swap the active key and orphan every encrypted record.
  it('prefers the SecureStore value and never overwrites it from the legacy store', async () => {
    await storeEncryptionKey(KEY, 'secure-key');
    await AsyncStorage.setItem(KEY, 'legacy-key');
    jest.clearAllMocks();

    await expect(getStoredEncryptionKey(KEY)).resolves.toBe('secure-key');

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(KEY)).resolves.toBe('legacy-key');
  });

  it('keeps keys isolated per storage key', async () => {
    await storeEncryptionKey('key-a', 'value-a');
    await storeEncryptionKey('key-b', 'value-b');

    await expect(getStoredEncryptionKey('key-a')).resolves.toBe('value-a');
    await expect(getStoredEncryptionKey('key-b')).resolves.toBe('value-b');

    await deleteStoredEncryptionKey('key-a');

    await expect(getStoredEncryptionKey('key-a')).resolves.toBeNull();
    await expect(getStoredEncryptionKey('key-b')).resolves.toBe('value-b');
  });

  // getEncryptionKey() (utils/encryption.ts) relies on the rejection to bail out rather than
  // silently generating a fresh key over the top of an existing, temporarily unreadable one.
  it('propagates a SecureStore read failure instead of falling through to the legacy store', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('Keystore unavailable')
    );

    await expect(getStoredEncryptionKey(KEY)).rejects.toThrow('Keystore unavailable');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });
});
