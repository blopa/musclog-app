import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CURRENT_ONBOARDING_VERSION,
  CURRENT_USER_SYNC_ID,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
} from '@/constants/misc';

type ImportRow = Record<string, unknown>;

function isImportRow(value: unknown): value is ImportRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Find the user the app should select when an older or compact export has no app metadata. */
export function findImportedCurrentUserSyncId(data: Record<string, unknown>): string | null {
  if (!Array.isArray(data.users)) {
    return null;
  }

  for (const user of data.users) {
    if (!isImportRow(user) || user.deleted_at != null || user._status === 'deleted') {
      continue;
    }

    if (typeof user.sync_id === 'string' && user.sync_id.trim()) {
      return user.sync_id;
    }
  }

  return null;
}

/**
 * An import that carries no app metadata (a compact export, a Musclog 1.x backup) still
 * holds a complete profile: mark it onboarded and select the imported user instead of
 * keeping a stale local user ID.
 */
export async function markImportedProfileOnboarded(currentUserSyncId: string | null) {
  const pairs: [string, string][] = [
    [ONBOARDING_COMPLETED, 'true'],
    // TODO: we might not want to force it to be the current version
    [ONBOARDING_VERSION, CURRENT_ONBOARDING_VERSION],
  ];

  if (currentUserSyncId) {
    pairs.push([CURRENT_USER_SYNC_ID, currentUserSyncId]);
  } else {
    await AsyncStorage.removeItem(CURRENT_USER_SYNC_ID);
  }

  await AsyncStorage.multiSet(pairs);
}
