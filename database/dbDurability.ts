import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { AppState, Platform } from 'react-native';

import { ENABLE_DB_LOSS_DETECTION } from '@/constants/database';
import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import { handleError } from '@/utils/handleError';
import { captureMessage } from '@/utils/sentry';

import { getBootDbFileStats } from './dbBootStats';
import { isDbReady, waitForDbReady } from './dbReady';
import { rawQueryViaWatermelon } from './wmdbRaw';

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

// 'jsi' or 'asynchronous' (bridge fallback). The fallback adapter has weaker
// durability (Android SQLiteDatabase WAL without synchronous=FULL), so loss
// reports must record which one the session ran on.
function getAdapterDispatcherType(): string {
  try {
    // Best-effort read of a private WatermelonDB field; guarded so a future
    // internals change degrades the breadcrumb to 'unknown' instead of throwing.
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

type CheckpointRow = { busy?: unknown; log?: unknown; checkpointed?: unknown };

async function runCheckpoint(mode: 'FULL' | 'TRUNCATE'): Promise<CheckpointRow> {
  const rows = await rawQueryViaWatermelon(`PRAGMA wal_checkpoint(${mode});`);
  return (rows[0] ?? {}) as CheckpointRow;
}

/**
 * Forces SQLite to move all committed WAL frames into the main database file.
 *
 * Must run through WatermelonDB's own connection: it works in both adapter
 * modes (JSI / bridge), it never opens-and-closes a second SQLite library on
 * the file (which unlinks the WAL — see wmdbRaw.ts), and because it uses the
 * live connection it even rescues frames sitting in an already-unlinked WAL by
 * copying them into the still-linked main DB file.
 */
export async function checkpointWalToMainDbFile(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    let result = await runCheckpoint('TRUNCATE');
    // busy=1 means readers blocked the checkpoint and frames may remain in the
    // WAL; FULL waits for writers but not for the WAL-restart step, so it can
    // still make progress where TRUNCATE could not.
    if (Number(result.busy) === 1) {
      result = await runCheckpoint('FULL');
    }

    Sentry.addBreadcrumb({
      category: 'db.durability',
      message: 'wal checkpoint',
      data: {
        busy: result.busy ?? null,
        log: result.log ?? null,
        checkpointed: result.checkpointed ?? null,
      },
    });
  } catch (error) {
    handleError(error, 'dbDurability.checkpointWalToMainDbFile');
  }
}

let monitoringStarted = false;

async function checkpointDbForBackgrounding(): Promise<void> {
  if (!isDbReady()) {
    return;
  }

  await checkpointWalToMainDbFile();
  if (ENABLE_DB_LOSS_DETECTION) {
    await updateNutritionLogCountBaseline();
  }
}

async function initializeDbDurabilityMonitoring(): Promise<void> {
  try {
    await waitForDbReady();

    // Rescue checkpoint: if a boot-time raw connection (pre-migration backup)
    // unlinked the WAL under the live connection, this persists everything
    // committed so far into the main DB file before any loss can occur.
    await checkpointWalToMainDbFile();

    if (ENABLE_DB_LOSS_DETECTION) {
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
}

/**
 * Call once at app boot (native only). Reports any between-session loss, then
 * keeps the count baseline fresh as nutrition logs change.
 */
export function startDbDurabilityMonitoring(): void {
  if (monitoringStarted || Platform.OS === 'web') {
    return;
  }

  monitoringStarted = true;

  AppState.addEventListener('change', (status) => {
    if (status === 'background') {
      void checkpointDbForBackgrounding();
    }
  });

  void initializeDbDurabilityMonitoring();
}

async function reportNutritionLogLossIfAny(): Promise<void> {
  try {
    const baseline = await readBaseline();
    const actual = await countNutritionLogs();

    if (baseline && actual < baseline.count) {
      // captureMessage checks the anonymous-bug-report consent setting before
      // sending; the DB is ready at this point so the check is reliable.
      await captureMessage('Nutrition logs lost between sessions', {
        level: 'error',
        extra: {
          expectedCount: baseline.count,
          actualCount: actual,
          lostRows: baseline.count - actual,
          baselineAt: new Date(baseline.at).toISOString(),
          adapterMode: getAdapterDispatcherType(),
          bootFileStats: getBootDbFileStats(),
        },
      });
    }

    await writeBaseline(actual);
  } catch (error) {
    handleError(error, 'dbDurability.reportNutritionLogLossIfAny');
  }
}
