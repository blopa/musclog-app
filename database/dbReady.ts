/**
 * DB-ready gate
 *
 * WatermelonDB temporarily swaps the real SQLite adapter for an ErrorAdapter
 * while `unsafeResetDatabase()` is in progress. Any query that hits the DB
 * during that window throws:
 *   "Cannot call database.adapter.underlyingAdapter while the database is being reset"
 *
 * This module provides a single shared promise that boot-time code (e.g.
 * configureDailyTasks) must await before touching the DB. The promise is
 * resolved by `seedProductionData` once the seeding flow has finished — both
 * the fast-path (already seeded) and the full reset+seed path.
 *
 * Usage:
 *   // producer — call once after seeding is complete
 *   import { markDbReady } from '@/database/dbReady';
 *   markDbReady();
 *
 *   // consumer — await before any DB access at boot
 *   import { waitForDbReady } from '@/database/dbReady';
 *   await waitForDbReady();
 */

let _resolve!: () => void;
const _dbReadyPromise = new Promise<void>((resolve) => {
  _resolve = resolve;
});

/** Call this once after seedProductionData() has fully completed. */
export const markDbReady = (): void => _resolve();

/** Await this before any boot-time DB access to avoid the reset race. */
export const waitForDbReady = (): Promise<void> => _dbReadyPromise;
