import { STALE_OPEN_PERIOD_DAYS } from '@/constants/cycle';
import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import type { CyclePeriodInput, PeriodEndKind } from './types';

export type PeriodRuleError =
  | 'period_date_in_future'
  | 'period_log_overlaps_existing'
  | 'period_end_before_start'
  | 'period_not_found';

export class PeriodRuleViolation extends Error {
  constructor(public readonly code: PeriodRuleError) {
    super(code);
    this.name = 'PeriodRuleViolation';
  }
}

type Interval = Pick<CyclePeriodInput, 'startDate' | 'endDate' | 'endKind'>;

/**
 * Last day a period occupies. Only a period the user said is still going runs to infinity: one
 * whose end is unknown occupies its start day, otherwise a forgotten end would make every later
 * period "overlap" it.
 */
export function periodLastDay(period: Interval): number {
  if (period.endDate != null) {
    return period.endDate;
  }

  return period.endKind === 'open' || period.endKind === undefined
    ? Number.POSITIVE_INFINITY
    : period.startDate;
}

export function isOpenPeriod(period: Interval): boolean {
  return period.endDate == null && (period.endKind === 'open' || period.endKind === undefined);
}

/**
 * The ONE answer to "is this period still going today?", read by the timeline (phase, wheel) and
 * the snapshot (banner, "Period ended" button) alike. An open period counts until
 * `STALE_OPEN_PERIOD_DAYS` after its start; after that the end was forgotten, not ongoing.
 */
export function isOngoingPeriod(period: Interval, today: number): boolean {
  const start = localDayStartFromUtcMs(period.startDate);
  const day = localDayStartFromUtcMs(today);

  return (
    isOpenPeriod(period) &&
    start <= day &&
    Math.round((day - start) / MS_PER_SOLAR_DAY) <= STALE_OPEN_PERIOD_DAYS
  );
}

export function findOverlap<T extends Interval & { id: string }>(
  existing: T[],
  candidate: Interval,
  ignoreIds: string[] = []
): T | null {
  const candidateEnd = periodLastDay(candidate);

  return (
    existing.find(
      (p) =>
        !ignoreIds.includes(p.id) &&
        p.startDate <= candidateEnd &&
        candidate.startDate <= periodLastDay(p)
    ) ?? null
  );
}

export function isFutureDay(day: number, now = Date.now()): boolean {
  return localDayStartFromUtcMs(day) > localDayStartFromUtcMs(now);
}

/** Throws a PeriodRuleViolation when the candidate cannot be stored next to `existing`. */
export function assertValidPeriod<T extends Interval & { id: string }>(
  existing: T[],
  candidate: Interval,
  options: { ignoreIds?: string[]; now?: number } = {}
): void {
  if (isFutureDay(candidate.startDate, options.now)) {
    throw new PeriodRuleViolation('period_date_in_future');
  }

  if (candidate.endDate != null && candidate.endDate < candidate.startDate) {
    throw new PeriodRuleViolation('period_end_before_start');
  }

  if (findOverlap(existing, candidate, options.ignoreIds)) {
    throw new PeriodRuleViolation('period_log_overlaps_existing');
  }
}

export interface InitialPeriod {
  startDate: number;
  endDate?: number | null;
  endKind?: PeriodEndKind;
}

/**
 * Periods entered during setup: de-duplicated by start day, oldest first. An entry without an end
 * stays honest about it: `unknown`, except the most recent one when it began within an average
 * period length ago, which may still be going (`open`).
 */
export function normalizeInitialPeriods(
  periods: InitialPeriod[],
  avgPeriodDuration: number,
  now = Date.now()
): { startDate: number; endDate: number | null; endKind: PeriodEndKind }[] {
  const byStart = new Map<number, InitialPeriod>();
  for (const period of periods) {
    const existing = byStart.get(period.startDate);
    if (!existing || (existing.endDate == null && period.endDate != null)) {
      byStart.set(period.startDate, period);
    }
  }

  const sorted = [...byStart.values()].sort((a, b) => a.startDate - b.startDate);
  const today = localDayStartFromUtcMs(now);

  return sorted.map((period, index) => {
    if (period.endDate != null) {
      return { startDate: period.startDate, endDate: period.endDate, endKind: 'logged' as const };
    }

    const mayStillBeGoing =
      index === sorted.length - 1 &&
      period.startDate + (avgPeriodDuration - 1) * MS_PER_SOLAR_DAY >= today;

    return {
      startDate: period.startDate,
      endDate: null,
      endKind: mayStillBeGoing ? ('open' as const) : ('unknown' as const),
    };
  });
}

/** Whether `day` falls inside any of the periods (an open one counts as still going). */
export function periodCoversDay(periods: Interval[], day: number): boolean {
  return periods.some((p) => day >= p.startDate && day <= periodLastDay(p));
}
