import type { Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CYCLE_BACKUP_STATUS_KEY } from '@/constants/cycle';
import { commitPrepared } from '@/database/commitPrepared';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import type CycleContext from '@/database/models/CycleContext';
import type CyclePeriod from '@/database/models/CyclePeriod';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import { chunked, fetchByIds, MAX_BATCH_OPERATIONS } from '@/database/queryByIds';
import {
  clearCycleDtoCache,
  CycleRepository,
  readContexts,
} from '@/database/repositories/CycleRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import {
  assertValidPeriod,
  type InitialPeriod,
  normalizeInitialPeriods,
} from '@/utils/cycle/periodRules';
import { cycleConfigSchema } from '@/utils/cycle/preferences';
import { type CycleTrackingMode, trackingLifeStage } from '@/utils/cycle/trackingMode';
import type { CycleConfig, CycleContextDto } from '@/utils/cycle/types';
import { getCurrentTimezone } from '@/utils/timezone';

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
    cycleConfigSchema.parse(input.config);
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
            effectiveFrom: localDayStartFromUtcMs(now),
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
    cycleConfigSchema.parse(config);
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

  /** Change the tracking choice without replacing the cycle or any of its logs. */
  static async setTrackingMode(cycle: MenstrualCycle, mode: CycleTrackingMode): Promise<void> {
    if (mode === 'skip') {
      await this.setActive(cycle, false);
      return;
    }

    await primeCycleEncryption();
    await database.write(async () => {
      const now = Date.now();
      const effectiveFrom = localDayStartFromUtcMs(now);
      const records = await CycleRepository.contexts(cycle.id).fetch();
      const contexts = await readContexts(records);
      const current = contexts
        .filter((c) => c.effectiveFrom <= effectiveFrom)
        .sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0];
      const lifeStage = trackingLifeStage(mode, current?.lifeStage ?? 'regular');
      const sameDay = records.find((r) =>
        contexts.some((c) => c.id === r.id && c.effectiveFrom === effectiveFrom)
      );
      const payload =
        lifeStage !== (current?.lifeStage ?? 'regular')
          ? await encryptCyclePayload({
              effectiveFrom,
              timezone: getCurrentTimezone(),
              lifeStage,
              contraception: current?.contraception ?? 'none',
              note: current?.effectiveFrom === effectiveFrom ? current.note : '',
            })
          : null;

      await commitPrepared(database, sameDay ? [cycle, sameDay] : [cycle], () => {
        const operations: Model[] = [];
        if (payload) {
          operations.push(
            sameDay
              ? sameDay.prepareUpdate((r) => {
                  r.payload = payload;
                  r.updatedAt = now;
                })
              : database.get<CycleContext>('cycle_contexts').prepareCreate((r) => {
                  r.cycleId = cycle.id;
                  r.payload = payload;
                  r.createdAt = now;
                  r.updatedAt = now;
                  r.deletedAt = null;
                })
          );
        }

        operations.push(
          cycle.prepareUpdate((r) => {
            r.isActive = true;
            r.updatedAt = now;
          })
        );
        return operations;
      });
    });
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
    await AsyncStorage.removeItem(CYCLE_BACKUP_STATUS_KEY);
  }
}
