/**
 * DB-ready gate
 *
 * WatermelonDB temporarily swaps the real SQLite adapter for an ErrorAdapter
 * while `unsafeResetDatabase()` is in progress. Any query that hits the DB
 * during that window throws:
 *   "Cannot call database.adapter.underlyingAdapter while the database is being reset"
 *
 * This module provides a single shared promise that boot-time code must await
 * before touching the DB. The promise resolves only after the app has proved
 * the database can be queried, and rejects if boot proves the database cannot
 * be made ready in this session.
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

let _isReady = false;
let _readyError: unknown = null;
let _resolve!: () => void;
let _reject!: (error: unknown) => void;
const _dbReadyPromise = new Promise<void>((resolve, reject) => {
  _resolve = resolve;
  _reject = reject;
});
void _dbReadyPromise.catch(() => {});

/** Call this once after seedProductionData() has fully completed. */
export const markDbReady = (): void => {
  if (_isReady || _readyError) {
    return;
  }

  _isReady = true;
  _resolve();
};

/** Call when boot proves the database cannot be made ready in this session. */
export const markDbReadyFailed = (error: unknown): void => {
  if (_isReady || _readyError) {
    return;
  }

  _readyError = error;
  _reject(error);
};

/** Await this before any boot-time DB access to avoid the reset race. */
export const waitForDbReady = (): Promise<void> => _dbReadyPromise;

/** Synchronous check for callers that need to defer optional work until DB reads are safe. */
export const isDbReady = (): boolean => _isReady;

/** Last terminal boot error, if DB readiness failed before the app could open. */
export const getDbReadyError = (): unknown => _readyError;
