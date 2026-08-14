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
