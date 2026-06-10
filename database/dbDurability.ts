import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { documentDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { DATABASE_NAME, SHOULD_SAVE_DB_SNAPSHOT } from '@/constants/database';
import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import { initializeSentry } from '@/sentry-init';
import { handleError } from '@/utils/handleError';

import { getBootDbFileStats } from './dbBootStats';
import { waitForDbReady } from './dbReady';

/**
 * Field incident (June 2026): nutrition logs that were visibly saved during a
 * session were gone from SQLite after the process was killed (memory pressure /
 * "close all"), with no tombstones. Every session whose data survived had opened
 * a second raw connection (export, pre-migration backup) — which checkpoints the
 * WAL into the main DB file on close. This module does two things:
 *
 *  1. Checkpoints the WAL on every app-background, so committed data no longer
 *     depends on the WAL tail surviving a process kill.
 *  2. Detects losses: persists the nutrition_logs row count and reports to
 *     Sentry when a boot finds fewer rows than the previous session left,
 *     including the adapter mode and the pre-open WAL file sizes captured in
 *     dbBootStats.ts.
 */

const NUTRITION_LOG_COUNT_BASELINE_KEY = 'nutrition_log_count_baseline_v1';
const BASELINE_UPDATE_DEBOUNCE_MS = 1500;

type CountBaseline = {
  count: number;
  at: number;
};

// Returns the directory where WatermelonDB's JSI adapter stores its database.
// See exportDb.ts wdbDir() for the full explanation.
function wdbDir(): string {
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}

// 'jsi' or 'asynchronous' (bridge fallback). The fallback adapter has weaker
// durability (Android SQLiteDatabase WAL without synchronous=FULL), so loss
// reports must record which one the session ran on.
function getAdapterDispatcherType(): string {
  try {
    const adapter = database.adapter as unknown as {
      underlyingAdapter?: { _dispatcherType?: string };
    };
    return adapter.underlyingAdapter?._dispatcherType ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function countNutritionLogs(): Promise<number> {
  return database.get<NutritionLog>('nutrition_logs').query().fetchCount();
}

async function readBaseline(): Promise<CountBaseline | null> {
  try {
    const raw = await AsyncStorage.getItem(NUTRITION_LOG_COUNT_BASELINE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.count === 'number' && typeof parsed.at === 'number') {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

async function writeBaseline(count: number): Promise<void> {
  await AsyncStorage.setItem(
    NUTRITION_LOG_COUNT_BASELINE_KEY,
    JSON.stringify({ count, at: Date.now() } satisfies CountBaseline)
  );
}

export async function updateNutritionLogCountBaseline(): Promise<void> {
  try {
    await writeBaseline(await countNutritionLogs());
  } catch (error) {
    handleError(error, 'dbDurability.updateNutritionLogCountBaseline');
  }
}

/**
 * Forces SQLite to move all committed WAL frames into the main database file.
 * Uses a separate raw connection so it works regardless of the WatermelonDB
 * adapter mode (JSI or bridge fallback).
 */
export async function checkpointWalToMainDbFile(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const dir = wdbDir();
  if (!dir) {
    return;
  }

  let db: ReturnType<typeof openDatabaseSync> | null = null;
  try {
    db = openDatabaseSync(`${DATABASE_NAME}.db`, { useNewConnection: true }, dir);
    await db.getAllAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (error) {
    handleError(error, 'dbDurability.checkpointWalToMainDbFile');
  } finally {
    try {
      db?.closeSync();
    } catch {
      // best effort
    }
  }
}

let monitoringStarted = false;
let dbIsReady = false;

/**
 * Call once at app boot (native only). Reports any between-session loss, then
 * keeps the count baseline fresh as nutrition logs change.
 */
export function startDbDurabilityMonitoring(): void {
  if (monitoringStarted || Platform.OS === 'web') {
    return;
  }

  monitoringStarted = true;

  void (async () => {
    try {
      await waitForDbReady();
      dbIsReady = true;

      if (SHOULD_SAVE_DB_SNAPSHOT) {
        await reportNutritionLogLossIfAny();

        let debounce: ReturnType<typeof setTimeout> | null = null;
        database.withChangesForTables(['nutrition_logs']).subscribe(() => {
          if (debounce) {
            clearTimeout(debounce);
          }
          debounce = setTimeout(() => {
            void updateNutritionLogCountBaseline();
          }, BASELINE_UPDATE_DEBOUNCE_MS);
        });
      }
    } catch (error) {
      handleError(error, 'dbDurability.startDbDurabilityMonitoring');
    }
  })();
}

/**
 * Wire to AppState 'background'. Checkpointing here is the actual mitigation:
 * after it, a process kill can no longer drop the session's committed writes.
 */
export async function checkpointDbOnAppBackground(): Promise<void> {
  if (!dbIsReady) {
    return;
  }

  await checkpointWalToMainDbFile();
  if (SHOULD_SAVE_DB_SNAPSHOT) {
    await updateNutritionLogCountBaseline();
  }
}

async function reportNutritionLogLossIfAny(): Promise<void> {
  try {
    const baseline = await readBaseline();
    const actual = await countNutritionLogs();
    const bootFileStats = getBootDbFileStats();
    const adapterMode = getAdapterDispatcherType();

    Sentry.addBreadcrumb({
      category: 'db.durability',
      message: 'boot db stats',
      data: {
        nutritionLogCount: actual,
        baselineCount: baseline?.count ?? null,
        adapterMode,
        ...bootFileStats,
      },
    });

    if (baseline && actual < baseline.count) {
      // Bypass the DB-dependent consent check, same as adapter.ts onError:
      // this event is the whole point of the monitoring and must not be lost.
      initializeSentry();
      Sentry.captureMessage('Nutrition logs lost between sessions', {
        level: 'error',
        extra: {
          expectedCount: baseline.count,
          actualCount: actual,
          lostRows: baseline.count - actual,
          baselineAt: new Date(baseline.at).toISOString(),
          adapterMode,
          bootFileStats,
        },
      });
    }

    await writeBaseline(actual);
  } catch (error) {
    handleError(error, 'dbDurability.reportNutritionLogLossIfAny');
  }
}
