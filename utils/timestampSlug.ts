/**
 * Filesystem-safe timestamp slug at second precision (e.g. "2026-07-08T18-14-57").
 * Canonical helper for backup/export filenames — keep the format stable so
 * previously written backup files stay recognisable and sortable.
 *
 * Deliberately dependency-free: it is imported from the pre-adapter boot path
 * (database/preMigrationCapture.ts), which must stay lightweight.
 */
export function timestampSlug(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
