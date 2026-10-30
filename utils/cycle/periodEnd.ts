import { addCalendarDays } from './dates';
import type { CyclePeriodInput, PeriodEndKind } from './types';

/** What the person said about how a period ended. */
export interface EndChoice {
  kind: PeriodEndKind;
  /** The date for `logged`; ignored by the other kinds. */
  date: number | null;
}

/**
 * Turns the choice into stored fields. `estimated` is the ONLY path that derives an end from the
 * usual length, and it is only taken when the person picked it, so a derived duration is never
 * passed off as a recorded one.
 */
export function resolveEnd(
  choice: EndChoice,
  startDate: number,
  usualDuration: number
): { endDate: number | null; endKind: PeriodEndKind } {
  switch (choice.kind) {
    case 'open':
      return { endDate: null, endKind: 'open' };
    case 'unknown':
      return { endDate: null, endKind: 'unknown' };
    case 'estimated':
      return { endDate: addCalendarDays(startDate, usualDuration - 1), endKind: 'estimated' };
    case 'logged':
      return { endDate: Math.max(choice.date ?? startDate, startDate), endKind: 'logged' };
  }
}

export function endChoiceOf(period: Pick<CyclePeriodInput, 'endDate' | 'endKind'>): EndChoice {
  const kind = period.endKind ?? (period.endDate == null ? 'open' : 'logged');

  return { kind, date: period.endDate };
}
