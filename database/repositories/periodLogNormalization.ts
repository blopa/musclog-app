import { type PeriodLogCreate } from '@/database/models/PeriodLog';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

function dedupeInitialPeriodLogs(
  logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[]
): Omit<PeriodLogCreate, 'menstrualCycleId'>[] {
  const logsByStartDate = new Map<number, Omit<PeriodLogCreate, 'menstrualCycleId'>>();

  for (const log of logs) {
    const existing = logsByStartDate.get(log.startDate);
    if (!existing || (existing.endDate == null && log.endDate != null)) {
      logsByStartDate.set(log.startDate, log);
    }
  }

  return [...logsByStartDate.values()];
}

export function normalizeInitialPeriodLogs(
  logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[],
  avgPeriodDuration: number,
  now = Date.now()
): Omit<PeriodLogCreate, 'menstrualCycleId'>[] {
  const sorted = dedupeInitialPeriodLogs(logs).sort((a, b) => a.startDate - b.startDate);

  return sorted.map((log, index) => {
    if (log.endDate != null) {
      return log;
    }

    const inferredEnd = log.startDate + (avgPeriodDuration - 1) * MS_PER_SOLAR_DAY;
    const isLastLog = index === sorted.length - 1;

    return {
      ...log,
      endDate: isLastLog && inferredEnd >= now ? null : inferredEnd,
    };
  });
}
