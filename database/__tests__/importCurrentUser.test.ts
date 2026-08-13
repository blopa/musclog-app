import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findImportedCurrentUserSyncId } from '@/database/importCurrentUser';

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

    expect(importSource).toContain('findImportedCurrentUserSyncId(dbData)');
    expect(importSource).toContain(
      'fallbackPairs.push([CURRENT_USER_SYNC_ID, importedCurrentUserSyncId])'
    );
    expect(importSource).toContain('AsyncStorage.removeItem(CURRENT_USER_SYNC_ID)');
  });
});
