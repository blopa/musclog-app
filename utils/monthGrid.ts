import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export interface MonthGridDay {
  date: Date;
  inMonth: boolean;
}

/**
 * The weeks shown for a month: whole weeks from the one containing the 1st to the one containing
 * the last day. Shared by the date picker and the cycle calendar so they cannot disagree about
 * which weekday a week starts on.
 */
export function monthGridDays(month: Date, weekStartsOn: 0 | 1 = 0): MonthGridDay[] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);

  return eachDayOfInterval({
    start: startOfWeek(first, { weekStartsOn }),
    end: endOfWeek(last, { weekStartsOn }),
  }).map((date) => ({ date, inMonth: date >= first && date <= last }));
}

/** Locale-formatting-free weekday order for a header row, starting from `weekStartsOn`. */
export function weekdayDates(reference: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfWeek(reference, { weekStartsOn });

  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
