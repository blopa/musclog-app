import { Q } from '@nozbe/watermelondb';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { reloadApp } from '@/utils/app';
import {
  legacyCreateTableSql,
  legacyInsertSql,
  type LegacyV1Dump,
  type LegacyV1TablePlan,
  planLegacyV1Tables,
} from '@/utils/legacyV1Backup';
import { resetWidgets } from '@/widgets/resetWidgets';

import { database } from './database-instance';
import { updateNutritionLogCountBaseline } from './dbDurability';
import { waitForBootMigrations } from './dbReady';
import { markImportedProfileOnboarded } from './importCurrentUser';
import type User from './models/User';
import { createPreRestoreBackup } from './preMigrationBackup';
import { seedDatabaseContents } from './seeders/prod';
import { MigrationService } from './services/MigrationService';
import { SettingsService } from './services/SettingsService';

// Not `withExclusiveTransactionAsync`: it runs on a second connection, and a second
// connection to `:memory:` is a separate, empty database. Nothing else uses this
// connection, so the ordering it protects against cannot happen here.
async function loadLegacyTables(source: SQLiteDatabase, plans: LegacyV1TablePlan[]) {
  await source.withTransactionAsync(async () => {
    for (const plan of plans) {
      await source.execAsync(legacyCreateTableSql(plan));
      if (plan.rows.length === 0) {
        continue;
      }

      const statement = await source.prepareAsync(legacyInsertSql(plan));
      try {
        for (const row of plan.rows) {
          await statement.executeAsync(row);
        }
      } finally {
        await statement.finalizeAsync();
      }
    }
  });
}

/**
 * Restore a Musclog 1.x JSON backup: a full replace, like `restoreDatabase`.
 *
 * The rows go into an in-memory SQLite database (never a file, so nothing can land next
 * to `musclog.db`) and `MigrationService` converts them exactly as it converts the 1.x
 * database an app upgrade leaves behind. The database is then reset and seeded the way a
 * fresh install is, with that migration in place of the device's own.
 */
export async function restoreLegacyV1Database(dump: LegacyV1Dump): Promise<void> {
  const source = await openDatabaseAsync(':memory:');

  try {
    // Build the source before anything is wiped: a file that cannot be loaded fails here.
    await loadLegacyTables(source, planLegacyV1Tables(dump));
    const migrationService = new MigrationService({ database: source, valuesEncrypted: false });

    // A 1.x backup carries no 2.0 settings, so keep the device's units and language rather
    // than letting the seeder fall back to locale defaults.
    const units = await SettingsService.getUnits();
    const language = await SettingsService.getLanguage();

    // A reset under a running boot migration throws (see FIXES.md).
    await waitForBootMigrations();
    await createPreRestoreBackup();

    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    const result = await seedDatabaseContents(migrationService);
    if (!result?.success) {
      throw new Error(`Musclog 1.x backup import failed: ${result?.error ?? 'no 1.x data found'}`);
    }

    await SettingsService.setUnits(units);
    await SettingsService.setLanguage(language);

    const users = await database
      .get<User>('users')
      .query(Q.where('deleted_at', Q.eq(null)), Q.take(1))
      .fetch();
    await markImportedProfileOnboarded(users[0]?.syncId ?? null);

    await updateNutritionLogCountBaseline();
  } finally {
    await source.closeAsync();
  }

  await resetWidgets();
  await reloadApp();
}
