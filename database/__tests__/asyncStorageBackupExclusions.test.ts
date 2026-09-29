import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENCRYPTION_KEY } from '@/constants/database';
import { TEMP_NUTRITION_PLAN } from '@/constants/misc';
import {
  WEB_BACKUP_DATA_PREFIX,
  WEB_BACKUP_DB_VERSION_KEY,
  WEB_BACKUP_INDEX_KEY,
} from '@/constants/exportImport';
import { captureAsyncStorageDump } from '@/database/asyncStorageBackup';

describe('captureAsyncStorageDump', () => {
  beforeEach(async () => {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove([...keys]);
    }
  });

  it('keeps ordinary app state', async () => {
    await AsyncStorage.multiSet([
      ['onboardingCompleted', 'true'],
      ['currentUserSyncId', 'user-1'],
    ]);

    expect(await captureAsyncStorageDump()).toEqual({
      onboardingCompleted: 'true',
      currentUserSyncId: 'user-1',
    });
  });

  it('excludes the device-specific keys a restore must not overwrite', async () => {
    await AsyncStorage.multiSet([
      [ENCRYPTION_KEY, 'secret'],
      [TEMP_NUTRITION_PLAN, '{}'],
      ['onboardingCompleted', 'true'],
    ]);

    expect(await captureAsyncStorageDump()).toEqual({ onboardingCompleted: 'true' });
  });

  /**
   * The payloads were already excluded, but the index that points at them and the schema
   * version marker were not — so an export embedded a list of backups whose contents were
   * deliberately left out. Restoring it wrote a phantom index whose entries read back
   * `null`, plus another install's db-version marker. All three are one predicate now.
   */
  it('excludes the web recovery-point bookkeeping, not just its payloads', async () => {
    await AsyncStorage.multiSet([
      [`${WEB_BACKUP_DATA_PREFIX}abc`, '{"dump":true}'],
      [WEB_BACKUP_INDEX_KEY, '[{"uri":"web-backup://abc"}]'],
      [WEB_BACKUP_DB_VERSION_KEY, '26'],
      ['onboardingCompleted', 'true'],
    ]);

    const dump = await captureAsyncStorageDump();

    expect(dump).toEqual({ onboardingCompleted: 'true' });
    expect(Object.keys(dump)).not.toContain(WEB_BACKUP_INDEX_KEY);
    expect(Object.keys(dump)).not.toContain(WEB_BACKUP_DB_VERSION_KEY);
  });
});
