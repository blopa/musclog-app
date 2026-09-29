import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENCRYPTION_KEY } from '@/constants/database';
import { WEB_BACKUP_DATA_PREFIX, WEB_BACKUP_INDEX_KEY } from '@/constants/exportImport';
import { clearAppAsyncStorage, replaceAppAsyncStorage } from '@/database/asyncStorageReset';

const ONBOARDING_COMPLETED = 'onboardingCompleted';
const SEEDING_COMPLETE = 'seeding_complete';

async function seedStorage(entries: Record<string, string>): Promise<void> {
  await AsyncStorage.multiSet(Object.entries(entries));
}

async function snapshot(): Promise<Record<string, null | string>> {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet([...keys]);
  return Object.fromEntries(pairs);
}

describe('app AsyncStorage reset', () => {
  beforeEach(async () => {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove([...keys]);
    }
  });

  it('never clears the web recovery points, which a restore is the safety net for', async () => {
    await seedStorage({
      [ENCRYPTION_KEY]: 'key',
      [ONBOARDING_COMPLETED]: 'true',
      [WEB_BACKUP_INDEX_KEY]: '[{"uri":"web-backup://abc"}]',
      [`${WEB_BACKUP_DATA_PREFIX}abc`]: '{"legacy":true}',
      musclog_last_db_version: '26',
    });

    await clearAppAsyncStorage([ENCRYPTION_KEY]);

    expect(await snapshot()).toEqual({
      [ENCRYPTION_KEY]: 'key',
      [WEB_BACKUP_INDEX_KEY]: '[{"uri":"web-backup://abc"}]',
      [`${WEB_BACKUP_DATA_PREFIX}abc`]: '{"legacy":true}',
      musclog_last_db_version: '26',
    });
  });

  it('overwrites restored keys in place instead of clearing them first', async () => {
    await seedStorage({
      [ENCRYPTION_KEY]: 'key',
      [ONBOARDING_COMPLETED]: 'true',
      [SEEDING_COMPLETE]: 'true',
      staleKey: 'stale',
    });

    // `onboardingCompleted` and `seeding_complete` must already hold their restored values
    // by the time anything is deleted: a window where they are absent makes the next boot
    // reseed the database and send the user back to onboarding.
    const multiSetSpy = jest.spyOn(AsyncStorage, 'multiSet');
    const multiRemoveSpy = jest.spyOn(AsyncStorage, 'multiRemove');

    await replaceAppAsyncStorage(
      [
        [ONBOARDING_COMPLETED, 'true'],
        [SEEDING_COMPLETE, 'true'],
        ['currentUserSyncId', 'user-1'],
      ],
      [ENCRYPTION_KEY]
    );

    const firstWrite = multiSetSpy.mock.invocationCallOrder[0];
    const firstRemoval = multiRemoveSpy.mock.invocationCallOrder[0];
    multiSetSpy.mockRestore();
    multiRemoveSpy.mockRestore();

    expect(firstWrite).toBeLessThan(firstRemoval);
    expect(await snapshot()).toEqual({
      [ENCRYPTION_KEY]: 'key',
      [ONBOARDING_COMPLETED]: 'true',
      [SEEDING_COMPLETE]: 'true',
      currentUserSyncId: 'user-1',
    });
  });
});
