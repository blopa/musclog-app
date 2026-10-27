import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_ONBOARDING_VERSION } from '@/constants/misc';
import {
  findImportedCurrentUserSyncId,
  markImportedProfileOnboarded,
} from '@/database/importCurrentUser';

const repositoryRoot = join(__dirname, '..', '..');

describe('import current-user fallback', () => {
  it('selects the first active imported user with a sync ID', () => {
    expect(
      findImportedCurrentUserSyncId({
        users: [
          { sync_id: 'deleted-user', deleted_at: 123 },
          { sync_id: 'game-boy-user', deleted_at: null },
          { sync_id: 'another-user' },
        ],
      })
    ).toBe('game-boy-user');
  });

  it('ignores malformed, deleted, and blank users', () => {
    expect(
      findImportedCurrentUserSyncId({
        users: [null, [], { sync_id: ' ' }, { sync_id: 'deleted', _status: 'deleted' }],
      })
    ).toBeNull();
    expect(findImportedCurrentUserSyncId({ foods: [] })).toBeNull();
  });

  it('uses the fallback when a restored export has no AsyncStorage metadata', () => {
    const importSource = readFileSync(join(repositoryRoot, 'database', 'importDb.ts'), 'utf8');

    expect(importSource).toContain(
      'markImportedProfileOnboarded(findImportedCurrentUserSyncId(dbData))'
    );
  });
});

describe('markImportedProfileOnboarded', () => {
  beforeEach(async () => {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove([...keys]);
    }

    await AsyncStorage.setItem('currentUserSyncId', 'stale-local-user');
  });

  it('marks the profile onboarded and selects the imported user', async () => {
    await markImportedProfileOnboarded('imported-user');

    expect(await AsyncStorage.getItem('onboardingCompleted')).toBe('true');
    expect(await AsyncStorage.getItem('onboardingVersion')).toBe(CURRENT_ONBOARDING_VERSION);
    expect(await AsyncStorage.getItem('currentUserSyncId')).toBe('imported-user');
  });

  // Keeping the previous device's user ID would point the app at a row the import wiped.
  it('drops the stale local user when the import has none', async () => {
    await markImportedProfileOnboarded(null);

    expect(await AsyncStorage.getItem('currentUserSyncId')).toBeNull();
    expect(await AsyncStorage.getItem('onboardingCompleted')).toBe('true');
  });
});
