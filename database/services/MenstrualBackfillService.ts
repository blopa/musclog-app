import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PERIOD_DURATION } from '@/constants/cycle';
import { waitForDbReady } from '@/database/dbReady';
import { MenstrualCycleRepository } from '@/database/repositories/MenstrualCycleRepository';
import { PeriodLogRepository } from '@/database/repositories/PeriodLogRepository';
import { NotificationService } from '@/services/NotificationService';
import { captureBootException } from '@/utils/bootErrorReporting';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { MenstrualService } from './MenstrualService';

const PERIOD_LOGS_BACKFILL_V22_KEY = 'PERIOD_LOGS_BACKFILL_V22_DONE';

export class MenstrualBackfillService {
  /**
   * One-time backfill for users upgrading from v21: seeds a period_log from the
   * last_period_start_date anchor that existed before the period_logs table was introduced.
   * Idempotent — guarded by an AsyncStorage key and a per-cycle existence check.
   */
  static async runV22Backfill(): Promise<void> {
    try {
      const alreadyDone = await AsyncStorage.getItem(PERIOD_LOGS_BACKFILL_V22_KEY);
      if (alreadyDone) {
        return;
      }

      await waitForDbReady();

      const cycles = await MenstrualCycleRepository.getAll().fetch();

      const logsToCreate = (
        await Promise.all(
          cycles
            .filter((cycle) => cycle.lastPeriodStartDate > 0)
            .map(async (cycle) => {
              const existing = await PeriodLogRepository.fetchForCycle(cycle.id);
              if (existing.length > 0) {
                return null;
              }

              const startDate = cycle.lastPeriodStartDate;
              const avgDuration = cycle.avgPeriodDuration || DEFAULT_PERIOD_DURATION;
              const inferredEnd = MenstrualService.inferPeriodEndDate(startDate, avgDuration);
              const periodEndExclusive = inferredEnd + MS_PER_SOLAR_DAY;
              const endDate = periodEndExclusive <= Date.now() ? inferredEnd : null;

              return {
                menstrualCycleId: cycle.id,
                startDate,
                endDate,
                timezone: cycle.timezone ?? undefined,
              };
            })
        )
      ).filter((l): l is NonNullable<typeof l> => l !== null);

      if (logsToCreate.length > 0) {
        await PeriodLogRepository.createMany(logsToCreate);
        void NotificationService.scheduleMenstrualCycleNotifications();
      }

      await AsyncStorage.setItem(PERIOD_LOGS_BACKFILL_V22_KEY, '1');
    } catch (err) {
      captureBootException(err, 'MenstrualBackfillService.runV22Backfill');
    }
  }
}
