import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_USER_SYNC_ID } from '@/constants/misc';
import {
  clearCurrentUserSyncId,
  getCurrentUserSyncId,
  setCurrentUserSyncId,
} from '@/utils/currentUserStorage';

describe('currentUserStorage', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('round-trips the sync id through AsyncStorage', async () => {
    await setCurrentUserSyncId('user-sync-1');

    await expect(getCurrentUserSyncId()).resolves.toBe('user-sync-1');
    await expect(AsyncStorage.getItem(CURRENT_USER_SYNC_ID)).resolves.toBe('user-sync-1');
  });

  it('returns null when no user has been persisted yet (fresh install)', async () => {
    await expect(getCurrentUserSyncId()).resolves.toBeNull();
  });

  it('overwrites a previously stored sync id', async () => {
    await setCurrentUserSyncId('user-sync-1');
    await setCurrentUserSyncId('user-sync-2');

    await expect(getCurrentUserSyncId()).resolves.toBe('user-sync-2');
  });

  it('clears the sync id on logout so the next read looks like a fresh install', async () => {
    await setCurrentUserSyncId('user-sync-1');
    await clearCurrentUserSyncId();

    await expect(getCurrentUserSyncId()).resolves.toBeNull();
  });

  // A read failure must never crash a caller resolving "who am I" — it degrades to "no user".
  it('swallows a read failure and resolves null', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage offline'));

    await expect(getCurrentUserSyncId()).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // Writes, by contrast, must surface: silently dropping the sync id would leave the app
  // resolving the wrong (or no) current user.
  it('rethrows when persisting fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(setCurrentUserSyncId('user-sync-1')).rejects.toThrow('disk full');
  });

  it('rethrows when clearing fails', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(clearCurrentUserSyncId()).rejects.toThrow('disk full');
  });
});
