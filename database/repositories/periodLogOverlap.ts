import type { default as PeriodLog, PeriodLogCreate } from '@/database/models/PeriodLog';

const OPEN_ENDED_PERIOD_END = Number.POSITIVE_INFINITY;

function periodIntervalEnd(log: Pick<PeriodLog, 'endDate'>): number {
  return log.endDate ?? OPEN_ENDED_PERIOD_END;
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA <= endB && startB <= endA;
}

export function findSameStartPeriodLog(
  existingLogs: PeriodLog[],
  startDate: number
): PeriodLog | null {
  return existingLogs.find((log) => log.startDate === startDate) ?? null;
}

export function hasOverlappingPeriodLog(
  existingLogs: PeriodLog[],
  candidate: Pick<PeriodLogCreate, 'startDate' | 'endDate'>,
  ignoreLogIds: string[] = []
): boolean {
  const candidateEnd = candidate.endDate ?? OPEN_ENDED_PERIOD_END;

  return existingLogs.some((log) => {
    if (ignoreLogIds.includes(log.id)) {
      return false;
    }

    return intervalsOverlap(
      log.startDate,
      periodIntervalEnd(log),
      candidate.startDate,
      candidateEnd
    );
  });
}
