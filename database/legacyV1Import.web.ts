import type { LegacyV1Dump } from '@/utils/legacyV1Backup';

/**
 * The 1.x conversion runs `MigrationService` over an in-memory SQLite database, and the
 * web build has no SQLite (its `MigrationService` is a stub). Refuse before anything is
 * wiped, so the current data stays as it is.
 */
export async function restoreLegacyV1Database(_dump: LegacyV1Dump): Promise<void> {
  throw new Error('Musclog 1.x backups can only be imported in the Android or iOS app.');
}
