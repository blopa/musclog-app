import type { Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import type CycleContext from '@/database/models/CycleContext';
import type CycleDayLog from '@/database/models/CycleDayLog';
import type CyclePeriod from '@/database/models/CyclePeriod';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import PeriodLog from '@/database/models/PeriodLog';
import UserMetric from '@/database/models/UserMetric';
import { createPreCycleEncryptionBackup } from '@/database/preMigrationBackup';
import { fetchByIds } from '@/database/queryByIds';
import { SettingsService } from '@/database/services/SettingsService';
import { convertLegacyCycleData, type LegacyMetric } from '@/utils/cycle/legacyConversion';
import { getCurrentTimezone } from '@/utils/timezone';

const LEGACY_METRIC_TYPES = ['period_flow', 'period_symptoms'];

/**
 * One-time (data-idempotent) conversion of the pre-v36 plaintext cycle data into the encrypted
 * tables. It needs the app's encryption key, so it cannot be a SQL migration.
 *
 * - Selects work by data (a cycle with no `config`, a leftover flow/symptom metric), never by a
 *   done-flag, so a restored backup that still carries old rows is converted on the next boot.
 * - A recovery backup is mandatory first: if it fails nothing is touched and a later boot retries.
 * - The old rows are destroyed (not soft-deleted) once their replacements are written, in the
 *   SAME batch, because plaintext symptom names must not linger on the device.
 */
export class CycleDataEncryptionMigration {
  static async run(): Promise<{ migratedCycles: number; migratedDays: number }> {
    const [cycles, metrics] = await Promise.all([
      database
        .get<MenstrualCycle>('menstrual_cycles')
        .query(Q.where('config', null), Q.where('deleted_at', Q.eq(null)))
        .fetchCount(),
      database
        .get<UserMetric>('user_metrics')
        .query(Q.where('type', Q.oneOf(LEGACY_METRIC_TYPES)))
        .fetchCount(),
    ]);
    if (cycles === 0 && metrics === 0) {
      return { migratedCycles: 0, migratedDays: 0 };
    }

    // The backup and keystore access happen before acquiring the writer. The complete
    // conversion then reads, encrypts and commits one authoritative snapshot.
    await createPreCycleEncryptionBackup();
    await primeCycleEncryption();
    const result = await database.write(async () => {
      const pendingCycles = await database
        .get<MenstrualCycle>('menstrual_cycles')
        .query(Q.where('config', null), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const legacyMetrics = await database
        .get<UserMetric>('user_metrics')
        .query(Q.where('type', Q.oneOf(LEGACY_METRIC_TYPES)))
        .fetch();

      if (pendingCycles.length === 0 && legacyMetrics.length === 0) {
        return { migratedCycles: 0, migratedDays: 0, preserveFertility: false };
      }

      // The key is already primed; finish every read and encryption before preparing models.
      const periods = await fetchByIds<PeriodLog>(
        'period_logs',
        'menstrual_cycle_id',
        pendingCycles.map((c) => c.id),
        Q.where('deleted_at', Q.eq(null))
      );
      const metrics: LegacyMetric[] = [];
      for (const metric of legacyMetrics) {
        if (metric.deletedAt != null) {
          continue;
        }

        const [decrypted, note] = await Promise.all([metric.getDecrypted(), metric.getNote()]);
        metrics.push({
          type: metric.type as LegacyMetric['type'],
          date: metric.date,
          value: decrypted.value,
          note: note ?? null,
          timezone: metric.timezone || null,
        });
      }

      const timezone = getCurrentTimezone();
      const converted = convertLegacyCycleData({
        cycles: pendingCycles.map((c) => ({
          id: c.id,
          avgCycleLength: c.avgCycleLength,
          avgPeriodDuration: c.avgPeriodDuration,
          birthControlType: c.birthControlType,
          lifeStage: c.lifeStage,
          createdAt: c.createdAt,
        })),
        periods: [
          ...periods.map((p) => ({
            cycleId: p.menstrualCycleId,
            startDate: p.startDate,
            endDate: p.endDate,
            notes: p.notes,
            timezone: p.timezone,
          })),
          // v21 installs only had the single cached anchor; the old v22 backfill turned it into a
          // period. That job is gone, so the conversion does it for a cycle with no period rows.
          ...pendingCycles
            .filter(
              (c) => c.lastPeriodStartDate > 0 && !periods.some((p) => p.menstrualCycleId === c.id)
            )
            .map((c) => ({
              cycleId: c.id,
              startDate: c.lastPeriodStartDate,
              endDate: null,
              notes: null,
              timezone: c.timezone,
            })),
        ],
        metrics,
        fallbackTimezone: timezone,
      });

      const cycleCiphers = new Map<string, string>();
      const periodCiphers = new Map<string, string[]>();
      const contextCiphers = new Map<string, string>();
      for (const [cycleId, data] of converted.cycles) {
        cycleCiphers.set(cycleId, await encryptCyclePayload(data.config));
        periodCiphers.set(
          cycleId,
          await Promise.all(data.periods.map((p) => encryptCyclePayload(p)))
        );
        if (data.context) {
          contextCiphers.set(cycleId, await encryptCyclePayload(data.context));
        }
      }

      const dayCiphers = await Promise.all(converted.dayLogs.map((d) => encryptCyclePayload(d)));

      const now = Date.now();
      const allLegacyPeriods = await fetchByIds<PeriodLog>(
        'period_logs',
        'menstrual_cycle_id',
        pendingCycles.map((c) => c.id)
      );
      const notes = await fetchByIds(
        'user_metrics_notes',
        'user_metric_id',
        legacyMetrics.map((m) => m.id)
      );
      const originals = [...allLegacyPeriods, ...legacyMetrics, ...notes];
      await commitPrepared(database, [...pendingCycles, ...originals], () => {
        const operations: Model[] = [];
        for (const cycle of pendingCycles) {
          operations.push(
            cycle.prepareUpdate((c) => {
              c.config = cycleCiphers.get(c.id) ?? null;
              // Blank the plaintext copies: they are no longer read and must not linger.
              c.avgCycleLength = 28;
              c.avgPeriodDuration = 5;
              c.useHormonalBirthControl = false;
              c.birthControlType = null;
              c.syncGoal = null;
              c.lifeStage = null;
              c.lastPeriodStartDate = 0;
              c.updatedAt = now;
            })
          );
          for (const cipher of periodCiphers.get(cycle.id) ?? []) {
            operations.push(
              database.get<CyclePeriod>('cycle_periods').prepareCreate((r) => {
                r.cycleId = cycle.id;
                r.payload = cipher;
                r.createdAt = now;
                r.updatedAt = now;
                r.deletedAt = null;
              })
            );
          }

          const contextCipher = contextCiphers.get(cycle.id);
          if (contextCipher) {
            operations.push(
              database.get<CycleContext>('cycle_contexts').prepareCreate((r) => {
                r.cycleId = cycle.id;
                r.payload = contextCipher;
                r.createdAt = now;
                r.updatedAt = now;
                r.deletedAt = null;
              })
            );
          }
        }

        for (const cipher of dayCiphers) {
          operations.push(
            database.get<CycleDayLog>('cycle_day_logs').prepareCreate((r) => {
              r.payload = cipher;
              r.createdAt = now;
              r.updatedAt = now;
              r.deletedAt = null;
            })
          );
        }

        operations.push(...originals.map((record) => record.prepareDestroyPermanently()));
        // Each adapter batch is a transaction. Splitting this list would mark a cycle
        // migrated before its replacements and plaintext cleanup have all committed.
        return operations;
      });
      return {
        migratedCycles: pendingCycles.length,
        migratedDays: converted.dayLogs.length,
        preserveFertility: pendingCycles.some((c) => c.isActive),
      };
    });
    if (result.preserveFertility) {
      await SettingsService.setCycleShowFertility(true);
    }

    return { migratedCycles: result.migratedCycles, migratedDays: result.migratedDays };
  }
}
