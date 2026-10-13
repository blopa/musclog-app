import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { clearCycleDtoCache } from '@/database/repositories/CycleRepository';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import type CycleContext from '@/database/models/CycleContext';
import type CyclePeriod from '@/database/models/CyclePeriod';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import { chunked, fetchByIds, MAX_BATCH_OPERATIONS } from '@/database/queryByIds';
import { CycleRepository } from '@/database/repositories/CycleRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import {
  assertValidPeriod,
  type InitialPeriod,
  normalizeInitialPeriods,
} from '@/utils/cycle/periodRules';
import type { CycleConfig, CycleContextDto } from '@/utils/cycle/types';
import { getCurrentTimezone } from '@/utils/timezone';

import type { Model } from '@nozbe/watermelondb';

export interface NewCycleInput {
  config: CycleConfig;
  periods: InitialPeriod[];
  context?: {
    lifeStage: CycleContextDto['lifeStage'];
    contraception: CycleContextDto['contraception'];
  } | null;
}

export class CycleTrackingService {
  /**
   * Starts tracking from scratch: deactivates any active cycle (kept, not deleted) and creates
   * the new cycle with its periods and context in ONE batch, so a failure leaves nothing half-made.
   */
  static async create(input: NewCycleInput): Promise<string> {
    await primeCycleEncryption();
    const now = Date.now();
    const timezone = getCurrentTimezone();
    const periods = normalizeInitialPeriods(
      input.periods,
      input.config.fallbackPeriodDuration,
      now
    );
    periods.forEach((p, index) =>
      assertValidPeriod(
        periods.slice(0, index).map((q, i) => ({ ...q, id: String(i) })),
        p,
        { now }
      )
    );

    const configCipher = await encryptCyclePayload(input.config);
    const periodCiphers = await Promise.all(
      periods.map((p) =>
        encryptCyclePayload({
          startDate: p.startDate,
          endDate: p.endDate,
          endKind: p.endKind,
          timezone,
          excludedFromStats: false,
          note: '',
        })
      )
    );
    const contextCipher =
      input.context &&
      (input.context.lifeStage !== 'regular' || input.context.contraception !== 'none')
        ? await encryptCyclePayload({
            effectiveFrom: localDayStartFromUtcMs(periods[0]?.startDate ?? now),
            timezone,
            lifeStage: input.context.lifeStage,
            contraception: input.context.contraception,
            note: '',
          })
        : null;

    return database.write(async () => {
      const active = await CycleRepository.cycles().fetch();
      const operations: Model[] = active
        .filter((c) => c.isActive)
        .map((c) =>
          c.prepareUpdate((r) => {
            r.isActive = false;
            r.updatedAt = now;
          })
        );

      const cycle = database.get<MenstrualCycle>('menstrual_cycles').prepareCreate((c) => {
        // The legacy plaintext columns stay at their defaults; nothing reads them any more.
        c.avgCycleLength = 28;
        c.avgPeriodDuration = 5;
        c.useHormonalBirthControl = false;
        c.birthControlType = null;
        c.lastPeriodStartDate = 0;
        c.timezone = timezone;
        c.syncGoal = null;
        c.lifeStage = null;
        c.isActive = true;
        c.config = configCipher;
        c.createdAt = now;
        c.updatedAt = now;
        c.deletedAt = null;
      });
      operations.push(cycle);

      periods.forEach((_, index) => {
        operations.push(
          database.get<CyclePeriod>('cycle_periods').prepareCreate((r) => {
            r.cycleId = cycle.id;
            r.payload = periodCiphers[index];
            r.createdAt = now;
            r.updatedAt = now;
            r.deletedAt = null;
          })
        );
      });

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

      await database.batch(...operations);

      return cycle.id;
    });
  }

  static async updateConfig(cycle: MenstrualCycle, config: CycleConfig): Promise<void> {
    await primeCycleEncryption();
    const cipher = await encryptCyclePayload(config);
    await database.write(async () => {
      await cycle.update((c) => {
        c.config = cipher;
        c.updatedAt = Date.now();
      });
    });
  }

  /** Pausing keeps every record; the cycle simply stops appearing and reminding. */
  static async setActive(cycle: MenstrualCycle, isActive: boolean): Promise<void> {
    await cycle.updateCycle({ isActive });
  }

  /**
   * Permanently destroys every cycle record, including the retired plaintext tables and metrics.
   * A soft delete would leave decryptable ciphertext on the device, which is the opposite of
   * what the person asked for.
   */
  static async deleteAll(): Promise<void> {
    await database.write(async () => {
      const tables = [
        'cycle_periods',
        'cycle_day_logs',
        'cycle_contexts',
        'period_logs',
        'menstrual_cycles',
      ];
      const records: Model[] = [];
      for (const table of tables) {
        records.push(...(await database.get(table).query().fetch()));
      }

      const metrics = await database
        .get('user_metrics')
        .query(Q.where('type', Q.oneOf(['period_flow', 'period_symptoms', 'basal_body_temp'])))
        .fetch();
      records.push(...metrics);
      records.push(
        ...(await fetchByIds(
          'user_metrics_notes',
          'user_metric_id',
          metrics.map((m) => m.id)
        ))
      );

      for (const chunk of chunked(records, MAX_BATCH_OPERATIONS)) {
        await database.batch(...chunk.map((r) => r.prepareDestroyPermanently()));
      }
    });

    clearCycleDtoCache();
    await SettingsService.resetCycleSettings();
  }
}
