import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { isStaticExport } from '@/constants/platform';
import { startDbDurabilityMonitoring } from '@/database/dbDurability';
import { isDbReady, markDbReady, markDbReadyFailed, waitForDbReady } from '@/database/dbReady';
import { waitForPreMigrationBackup } from '@/database/preMigrationBackup';
import {
  ExerciseService,
  FoodPortionService,
  FoodService,
  MuscleService,
  NutritionGoalService,
  NutritionService,
  SettingsService,
  TimezoneMigrationService,
  UserMetricService,
  WorkoutService,
} from '@/database/services';
import { captureBootException } from '@/utils/bootErrorReporting';
import {
  beginBootProgress,
  completeBootProgressStep,
  finishBootProgress,
} from '@/utils/bootProgress';
import { isOnboardingCompleted } from '@/utils/onboardingService';

const DB_RESET_RACE_ERRORS = [
  'No driver with tag',
  'Cannot call database.adapter.underlyingAdapter while the database is being reset',
];
const DB_READY_PROBE_SLOW_REPORT_MS = 15_000;
const DB_READY_PROBE_MAX_ELAPSED_MS = 45_000;
const BOOT_MIGRATION_SLOW_REPORT_MS = 30_000;

type BootMigration = {
  tag: string;
  webOnly?: boolean;
  runOnce?: boolean;
  run: (cutoffMs: number) => Promise<unknown>;
};

type Cancelled = () => boolean;

const bootMigrationDoneKey = (tag: string) => `boot_migration_done:${tag}`;
const bootMigrationCutoffKey = (tag: string) => `boot_migration_cutoff:${tag}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDbReadyRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return DB_RESET_RACE_ERRORS.some((needle) => msg.includes(needle));
}

async function getRunOnceMigrationCutoff(tag: string): Promise<number> {
  const key = bootMigrationCutoffKey(tag);
  const existing = await AsyncStorage.getItem(key);
  const parsed = existing ? Number(existing) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const cutoff = Date.now();
  await AsyncStorage.setItem(key, String(cutoff));
  return cutoff;
}

// Native WatermelonDB schema migrations can miss web/LokiJS data rewrites, so
// webOnly boot migrations cover those platform-specific gaps after boot.
// runOnce migrations record a stable cutoff because repeating them later could
// overwrite user-edited data with stale historical assumptions.
const BOOT_MIGRATIONS: BootMigration[] = [
  {
    tag: 'fixNegativeFiber',
    run: () =>
      Promise.all([
        NutritionGoalService.fixNegativeFiber().catch((err) =>
          captureBootException(err, 'NutritionGoalService.fixNegativeFiber')
        ),
        FoodService.fixNegativeFiber().catch((err) =>
          captureBootException(err, 'FoodService.fixNegativeFiber')
        ),
        NutritionService.fixNegativeFiber().catch((err) =>
          captureBootException(err, 'NutritionService.fixNegativeFiber')
        ),
      ]),
  },
  {
    tag: 'ExerciseService.backfillExerciseSources',
    // Watermelon's native SQL migration covered SQLite; LokiJS needs boot-time data repair.
    webOnly: true,
    run: () => ExerciseService.backfillExerciseSources(),
  },
  {
    tag: 'FoodPortionService.backfillPortionSources',
    // Watermelon's native SQL migration covered SQLite; LokiJS needs boot-time data repair.
    webOnly: true,
    run: () => FoodPortionService.backfillPortionSources(),
  },
  {
    tag: 'ExerciseService.syncAppExercises',
    run: async () => {
      await ExerciseService.syncAppExercises();
      await ExerciseService.syncExerciseMultipliers();
    },
  },
  {
    tag: 'ExerciseService.backfillExerciseOrderIndex',
    run: () => ExerciseService.backfillExerciseOrderIndex(),
  },
  {
    tag: 'MuscleService.backfillExerciseMuscles',
    run: () => MuscleService.backfillExerciseMuscles(),
  },
  {
    tag: 'ExerciseService.migrateExerciseImageUrlsToCloud',
    // Web skipped the native migration path that rewrites bundled image URLs.
    webOnly: true,
    run: () => ExerciseService.migrateExerciseImageUrlsToCloud(),
  },
  {
    tag: 'WorkoutService.backfillNullTotalVolumes',
    run: () => WorkoutService.backfillNullTotalVolumes(),
  },
  {
    tag: 'UserMetricService.backfillTimezoneOffsets',
    run: () => UserMetricService.backfillTimezoneOffsets(),
  },
  {
    tag: 'TimezoneMigrationService.backfillMissingTimezones',
    run: () => TimezoneMigrationService.backfillMissingTimezones(),
  },
  {
    tag: 'TimezoneMigrationService.repairNullTimezoneNutritionLogs',
    run: () => TimezoneMigrationService.repairNullTimezoneNutritionLogs(),
  },
  {
    tag: 'TimezoneMigrationService.backfillConsumedTimeFromCreatedAt',
    // Use the first-run cutoff so future edits are never re-derived from created_at.
    runOnce: true,
    run: (cutoffMs) => TimezoneMigrationService.backfillConsumedTimeFromCreatedAt(cutoffMs),
  },
  {
    tag: 'SettingsService.migrateApiKeysToEncrypted',
    run: () => SettingsService.migrateApiKeysToEncrypted(),
  },
  {
    tag: 'SettingsService.migrateRequireExportEncryptionDefault',
    run: () => SettingsService.migrateRequireExportEncryptionDefault(),
  },
];

function getActiveBootMigrations(): BootMigration[] {
  return BOOT_MIGRATIONS.filter((m) => !m.webOnly || Platform.OS === 'web');
}

async function waitForExistingDbReady(cancelled: Cancelled): Promise<void> {
  await waitForPreMigrationBackup();
  if (cancelled()) {
    return;
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  let attempt = 0;

  const slowTimer = setTimeout(() => {
    if (!cancelled()) {
      captureBootException(
        new Error('DB-ready probe is still waiting'),
        'AppBoot.dbReadyProbe.slow',
        {
          attempt,
          elapsedMs: elapsed(),
        }
      );
    }
  }, DB_READY_PROBE_SLOW_REPORT_MS);

  const probe = async (): Promise<void> => {
    while (!cancelled()) {
      try {
        await SettingsService.getAnonymousBugReport();
        return;
      } catch (err: unknown) {
        if (cancelled()) {
          return;
        }

        if (isDbReadyRetryableError(err) && elapsed() < DB_READY_PROBE_MAX_ELAPSED_MS) {
          attempt += 1;
          await sleep(200);
          continue;
        }

        if (isDbReadyRetryableError(err)) {
          throw new Error(
            `DB-ready probe timed out after ${elapsed()}ms and ${attempt} retry attempt(s)`
          );
        }

        // A non reset-race error won't clear by waiting, so stop probing and let
        // boot proceed to markDbReady rather than blocking the app indefinitely.
        captureBootException(err, 'AppBoot.dbReadyProbe', {
          attempt,
          elapsedMs: elapsed(),
          retryable: false,
        });
        return;
      }
    }
  };

  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<void>((resolve, reject) => {
    watchdogTimer = setTimeout(() => {
      if (cancelled()) {
        resolve();
        return;
      }

      reject(
        new Error(
          `DB-ready probe watchdog elapsed after ${elapsed()}ms and ${attempt} retry attempt(s)`
        )
      );
    }, DB_READY_PROBE_MAX_ELAPSED_MS);
  });

  try {
    await Promise.race([probe(), watchdog]);
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(watchdogTimer);
  }
}

async function runBootMigration(m: BootMigration): Promise<void> {
  const startedAt = Date.now();
  const slowTimer = setTimeout(() => {
    captureBootException(
      new Error('Boot migration is still running'),
      'AppBoot.bootMigration.slow',
      {
        tag: m.tag,
        elapsedMs: Date.now() - startedAt,
      }
    );
  }, BOOT_MIGRATION_SLOW_REPORT_MS);

  try {
    if (m.runOnce && (await AsyncStorage.getItem(bootMigrationDoneKey(m.tag)))) {
      return;
    }

    const cutoffMs = m.runOnce ? await getRunOnceMigrationCutoff(m.tag) : Date.now();
    await m.run(cutoffMs);

    if (m.runOnce) {
      await AsyncStorage.setItem(bootMigrationDoneKey(m.tag), '1');
      await AsyncStorage.removeItem(bootMigrationCutoffKey(m.tag));
    }
  } catch (err) {
    captureBootException(err, 'AppBoot.bootMigration', {
      tag: m.tag,
      runOnce: m.runOnce === true,
      webOnly: m.webOnly === true,
    });
  } finally {
    clearTimeout(slowTimer);
    completeBootProgressStep();
  }
}

export async function runDatabaseBootSequence(cancelled: Cancelled): Promise<void> {
  if (isStaticExport) {
    markDbReady();
    return;
  }

  startDbDurabilityMonitoring();

  try {
    const migrations = getActiveBootMigrations();
    const onboardingDone = await isOnboardingCompleted();

    if (onboardingDone) {
      // The DB-ready step hides the pre-migration backup and the WatermelonDB
      // schema migration, which on an upgrade can take far longer than every
      // quick data-repair migration combined. Weight it to ~half the bar so the
      // trickle has room to move while it runs, instead of the bar snapping from
      // 0% straight to one step's worth once it finally lands.
      const dbReadyStepWeight = Math.max(1, migrations.length);
      beginBootProgress([dbReadyStepWeight, ...migrations.map(() => 1)]);
      await waitForExistingDbReady(cancelled);
      if (cancelled()) {
        return;
      }

      completeBootProgressStep();
      markDbReady();
    } else {
      await waitForDbReady();
      if (cancelled()) {
        return;
      }

      beginBootProgress(migrations.map(() => 1));
    }

    // Run boot migrations sequentially in declared order. Several repairs touch
    // overlapping tables/rows (e.g. fixNegativeFiber vs the timezone repairs on
    // nutrition_logs/nutrition_goals, and the exercise backfills on the exercises
    // table), and `backfillConsumedTimeFromCreatedAt` reads the timezone that
    // `repairNullTimezoneNutritionLogs` writes. Running them concurrently let
    // separately-loaded model instances clobber each other's column updates
    // (last-write-wins on stale reads). The array order already encodes these
    // dependencies, so sequencing is sufficient. `runBootMigration` swallows its
    // own errors, so one failure does not stop the rest of the chain.
    for (const m of migrations) {
      if (cancelled()) {
        return;
      }

      await runBootMigration(m);
    }

    if (!cancelled()) {
      finishBootProgress();
    }
  } catch (err) {
    captureBootException(err, 'AppBoot.databaseBootSequence');

    if (!cancelled() && !isDbReady()) {
      markDbReadyFailed(err);
    }

    finishBootProgress();
  }
}

export function stopDatabaseBootProgress(): void {
  finishBootProgress();
}
