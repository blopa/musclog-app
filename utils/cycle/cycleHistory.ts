import { MIN_PLAUSIBLE_CYCLE_DAYS, MISSED_PERIOD_RATIO } from '@/constants/cycle';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import type { CycleExclusionReason, CycleHistoryEntry, CyclePeriodInput } from './types';

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function dayDiff(from: number, to: number): number {
  return Math.round((to - from) / MS_PER_SOLAR_DAY);
}

/**
 * One entry per cycle (period start to next period start), oldest first. A cycle is never
 * silently dropped: ones that should not feed predictions stay in the list with a reason.
 */
export function buildCycleHistory(
  periods: CyclePeriodInput[],
  /** Reason a cycle starting on this day is not a natural cycle (hormonal method, postpartum). */
  contextExclusion?: (startDate: number) => CycleExclusionReason | null
): CycleHistoryEntry[] {
  const sorted = [...periods].sort((a, b) => a.startDate - b.startDate);

  const entries: CycleHistoryEntry[] = sorted.map((period, index) => {
    const next = sorted[index + 1];
    const durationKnown =
      period.endDate != null && (period.endKind === undefined || period.endKind === 'logged');
    const durationDays =
      period.endDate != null
        ? Math.max(1, dayDiff(period.startDate, period.endDate) + 1)
        : undefined;

    if (!next) {
      return {
        start: period.startDate,
        durationDays,
        durationKnown,
        status: 'in_progress',
      };
    }

    const entry: CycleHistoryEntry = {
      start: period.startDate,
      nextStart: next.startDate,
      lengthDays: dayDiff(period.startDate, next.startDate),
      durationDays,
      durationKnown,
      status: 'used',
    };

    const contextReason = contextExclusion?.(period.startDate) ?? null;
    if (period.excludedFromStats) {
      entry.status = 'excluded';
      entry.reason = 'user_excluded';
    } else if (contextReason) {
      entry.status = 'excluded';
      entry.reason = contextReason;
    } else if (entry.lengthDays! < MIN_PLAUSIBLE_CYCLE_DAYS) {
      entry.status = 'excluded';
      entry.reason = 'too_short';
    }

    return entry;
  });

  // A cycle much longer than the rest probably hides an unlogged period. It needs other cycles
  // to compare with, otherwise a user with naturally long cycles would be flagged on every one.
  const candidates = entries.filter((e) => e.status === 'used');
  for (const entry of candidates) {
    const others = candidates.filter((e) => e !== entry).map((e) => e.lengthDays!);
    const confirmed = sorted.find((p) => p.startDate === entry.start)?.confirmedLongCycle;
    if (
      !confirmed &&
      others.length >= 2 &&
      entry.lengthDays! >= median(others) * MISSED_PERIOD_RATIO
    ) {
      entry.status = 'excluded';
      entry.reason = 'possible_missed_period';
    }
  }

  return entries;
}
